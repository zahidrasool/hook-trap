import ipaddress
import socket

import httpx
import pytest
from sqlalchemy import select

from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult
from app.services.scenario_run_service import cancel_run, claim_next_run, create_run, mark_running
from app.services.scenario_worker import execute_run, run_once


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Hostnames resolve to one public address; IP literals resolve to themselves.

    Mirroring the real resolver matters. `getaddrinfo` on an IP literal returns
    that IP unchanged, so a mock that laundered every host into a public
    address would quietly make the blocked-address tests vacuous — the metadata
    address would "resolve" to something public and sail through the guard.
    """

    def _getaddrinfo(host, port, *args, **kwargs):
        bare = host.strip("[]")
        if bare == "localhost":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", port or 0))]
        try:
            ipaddress.ip_address(bare)
            resolved = bare
        except ValueError:
            resolved = "93.184.216.34"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (resolved, port or 0))]

    monkeypatch.setattr(socket, "getaddrinfo", _getaddrinfo)


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def _scenario(db, workspace, steps, *, short_id, variables=None, timeout_seconds=120):
    scenario = Scenario(
        workspace_id=workspace.id,
        short_id=short_id,
        name="Checkout",
        slug=short_id,
        steps=steps,
        variables=variables or {},
        timeout_seconds=timeout_seconds,
    )
    db.add(scenario)
    await db.flush()
    return scenario


@pytest.mark.asyncio
async def test_a_run_of_passing_steps_passes(db_session, test_workspace):
    def handler(request):
        return httpx.Response(200, json={"id": "p_1"})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "delay", "seconds": 0},
            {
                "type": "http_request",
                "method": "GET",
                "url": "https://example.com/x",
                "assert": ["status == 200"],
            },
        ],
        short_id="wrk0000001",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session, client=_client(handler))

    assert status == "passed"
    results = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    assert [r.step_index for r in results] == [0, 1]


@pytest.mark.asyncio
async def test_a_failed_assertion_fails_the_run_but_later_steps_still_run(
    db_session, test_workspace
):
    """One report should show every problem, not only the first."""
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(500, json={})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "http_request", "method": "GET", "url": "https://example.com/a",
             "assert": ["status == 200"]},
            {"type": "http_request", "method": "GET", "url": "https://example.com/b",
             "assert": ["status == 200"]},
        ],
        short_id="wrk0000002",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session, client=_client(handler))

    assert status == "failed"
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_stop_on_failure_halts_the_run(db_session, test_workspace):
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(500, json={})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "http_request", "method": "GET", "url": "https://example.com/a",
             "assert": ["status == 200"], "stop_on_failure": True},
            {"type": "http_request", "method": "GET", "url": "https://example.com/b"},
        ],
        short_id="wrk0000003",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session, client=_client(handler))

    assert status == "failed"
    assert len(calls) == 1
    results = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    skipped = [r for r in results if r.status == "skipped"]
    assert len(skipped) == 1


@pytest.mark.asyncio
async def test_an_engine_error_ends_the_run_as_error_not_failed(db_session, test_workspace):
    """CI must tell 'your app returned the wrong status' from 'we could not
    reach your app'."""
    scenario = await _scenario(
        db_session,
        test_workspace,
        [{"type": "http_request", "method": "GET", "url": "http://169.254.169.254/latest/"}],
        short_id="wrk0000004",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session)

    assert status == "error"


@pytest.mark.asyncio
async def test_captured_variables_flow_into_later_steps(db_session, test_workspace):
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(200, json={"id": "p_1"})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "http_request", "method": "POST", "url": "https://example.com/pay",
             "capture": {"paymentId": "response.body.id"}},
            {"type": "http_request", "method": "GET", "url": "https://example.com/pay/{{paymentId}}"},
        ],
        short_id="wrk0000005",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    await execute_run(run, db_session, client=_client(handler))

    assert seen[1].endswith("/pay/p_1")


@pytest.mark.asyncio
async def test_scenario_variables_seed_the_namespace(db_session, test_workspace):
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(200, json={})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [{"type": "http_request", "method": "GET", "url": "{{baseUrl}}/x"}],
        short_id="wrk0000006",
        variables={"baseUrl": "https://example.com"},
    )
    run = await create_run(scenario, {}, "manual", db_session)

    await execute_run(run, db_session, client=_client(handler))

    assert seen[0] == "https://example.com/x"


@pytest.mark.asyncio
async def test_trigger_variables_override_scenario_variables(db_session, test_workspace):
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(200, json={})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [{"type": "http_request", "method": "GET", "url": "{{baseUrl}}/x"}],
        short_id="wrk0000007",
        variables={"baseUrl": "https://scenario"},
    )
    run = await create_run(scenario, {"baseUrl": "https://trigger"}, "api", db_session)

    await execute_run(run, db_session, client=_client(handler))

    assert seen[0] == "https://trigger/x"


@pytest.mark.asyncio
async def test_run_once_claims_and_executes(db_session, test_workspace):
    scenario = await _scenario(
        db_session, test_workspace, [{"type": "delay", "seconds": 0}], short_id="wrk0000008"
    )
    await create_run(scenario, {}, "manual", db_session)

    did_work = await run_once(db_session)

    assert did_work is True
    run = (await db_session.execute(select(ScenarioRun))).scalars().first()
    assert run.status == "passed"


@pytest.mark.asyncio
async def test_run_once_reports_no_work_when_the_queue_is_empty(db_session):
    assert await run_once(db_session) is False


@pytest.mark.asyncio
async def test_a_run_cancelled_in_another_session_stays_cancelled(db_engine, test_workspace):
    """A worker's in-memory `run` is loaded once, at claim time, in its own
    session. If a user cancels the run from a different session (a real
    request handler, never the worker's own session) while the worker is
    still executing it, the worker's copy does not update on its own —
    SQLAlchemy's identity map does not refresh an already-loaded object just
    because another session committed a change to that row. Without an
    explicit refresh before the final write, finish_run's terminal-status
    guard reads the worker's stale "running" value, never trips, and
    overwrites the user's cancellation.
    """
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as setup_db:
        scenario = await _scenario(
            setup_db, test_workspace, [{"type": "delay", "seconds": 0}], short_id="wrk0000009"
        )
        run = await create_run(scenario, {}, "manual", setup_db)
        run_id = run.id
        await setup_db.commit()

    # The worker: claims and marks the run running in its own session, then
    # commits the claim, exactly as run_once does. Opened outside an `async
    # with` because the test needs to keep using it across the cancellation
    # below, so cleanup is explicit in `finally` — on the failure path just as
    # much as the success path. Skipping that turns one assertion failure into
    # a session left open mid-transaction, holding whatever row locks its
    # statements took, which blocks every later test's teardown in the same
    # database.
    worker_db = factory()
    try:
        claimed = await claim_next_run(worker_db)
        assert claimed is not None
        await mark_running(claimed, worker_db)
        await worker_db.commit()

        # A different session, standing in for a user's cancel request
        # arriving while the worker is mid-run.
        async with factory() as user_db:
            run_for_cancel = await user_db.get(ScenarioRun, run_id)
            assert await cancel_run(run_for_cancel, user_db) is True
            await user_db.commit()

        def handler(request):
            return httpx.Response(200, json={})

        status = await execute_run(claimed, worker_db, client=_client(handler))
        # execute_run must report the status the run actually reached, not the
        # outcome it computed — finish_run refused the move, so the run stayed
        # "cancelled" and that is what the caller (Task 5's run API) must see.
        assert status == "cancelled"
        # Mirror _loop's own commit after run_once — the write execute_run
        # made is only durable once this happens, exactly as in production.
        await worker_db.commit()

        async with factory() as check_db:
            final = await check_db.get(ScenarioRun, run_id)
            assert final.status == "cancelled", (
                f"run_once returned {status!r} but the durable status is "
                f"{final.status!r}; the worker must not overwrite a user's "
                f"cancellation"
            )
    finally:
        await worker_db.rollback()
        await worker_db.close()


@pytest.mark.asyncio
async def test_a_non_dict_step_still_writes_a_result_and_reports_the_executor_message(
    db_session, test_workspace
):
    """ScenarioUpdate.steps accepts any list, so PATCH {"steps": ["oops"]} is
    valid input. A bare string in the list must not crash execute_run before
    execute_step gets a chance to report its own "Step must be an object"
    message, and a step row must still be written for it.
    """
    scenario = await _scenario(
        db_session, test_workspace, ["oops"], short_id="wrk0000010"
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session)

    assert status == "error"
    results = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    assert len(results) == 1
    assert results[0].step_type == "unknown"
    assert results[0].status == "error"
    assert "Step must be an object" in results[0].error
