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


@pytest.mark.asyncio
async def test_a_run_exceeding_its_timeout_finishes_as_timeout_not_passed(
    db_session, test_workspace
):
    """`sweep_timed_out_runs` runs at the top of `run_once`, before the claim —
    it cannot fire while `execute_run` is awaiting a run's own steps, since
    `_loop` has no other body. Without a per-step deadline inside
    `execute_run` itself, a scenario's declared timeout_seconds is
    unenforceable and a run that blows straight past it reports "passed".
    """
    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "delay", "seconds": 5},
            {"type": "delay", "seconds": 0},
        ],
        short_id="wrk0000011",
        timeout_seconds=1,
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session)

    assert status == "timeout"
    results = (
        await db_session.execute(
            select(ScenarioStepResult).order_by(ScenarioStepResult.step_index)
        )
    ).scalars().all()
    assert len(results) == 2
    # Step 0 actually ran — its delay was clamped to the remaining budget
    # rather than refused — and only the step that would have run past the
    # deadline is skipped.
    assert results[0].status == "passed"
    assert results[1].status == "skipped"


@pytest.mark.asyncio
async def test_a_run_whose_wait_times_out_finishes_failed_not_passed(
    db_session, test_workspace, test_user
):
    """A false green on the headline feature is the worst possible outcome for
    a testing product: a webhook that never arrives must fail the run, not
    merely record a `timeout` step that the run then reports as `passed`."""
    from app.services.scenario_service import create_scenario

    scenario = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)
    scenario.steps = [{"type": "wait_for_webhook", "timeout_seconds": 0.1}]
    scenario.timeout_seconds = 120
    await db_session.flush()
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session)

    assert status == "failed"
    results = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    assert len(results) == 1
    assert results[0].status == "timeout"


@pytest.mark.asyncio
async def test_a_wait_clamped_by_the_runs_budget_reports_the_runs_timeout_not_a_failed_step(
    db_session, test_workspace, test_user
):
    """A wait_for_webhook declaring `timeout_seconds: 60` on a run whose own
    `timeout_seconds` is 1 expires because the *run's* budget ran out, not
    because the step's own declared 60s elapsed. The run must report
    `timeout`, with the run-level "exceeded its Ns timeout_seconds" message —
    not `failed` — and the step's own error must not misattribute the
    engine's budget to the step by quoting the clamped value as if the
    author had written a short timeout.
    """
    from app.services.scenario_service import create_scenario

    scenario = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)
    scenario.steps = [{"type": "wait_for_webhook", "timeout_seconds": 60}]
    scenario.timeout_seconds = 1
    await db_session.flush()
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session)

    assert status == "timeout"
    results = (
        await db_session.execute(
            select(ScenarioStepResult).order_by(ScenarioStepResult.step_index)
        )
    ).scalars().all()
    assert len(results) == 1
    assert results[0].status == "timeout"
    assert "60" not in results[0].error
    assert "budget" in results[0].error.lower()

    await db_session.refresh(run)
    assert run.status == "timeout"
    assert "1s timeout_seconds" in run.error


@pytest.mark.asyncio
async def test_a_cancelled_run_stops_issuing_requests(db_engine, test_workspace):
    """Before this fix, `execute_run` never re-read the run's status between
    steps — the only check was the final `db.refresh` right before the last
    write. A user cancelling a ten-step run got `{"status": "cancelled"}`
    back immediately while the worker kept making outbound requests to their
    application for every remaining step. Only the bookkeeping was cancelled.
    """
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    calls = []

    async with factory() as setup_db:
        scenario = await _scenario(
            setup_db,
            test_workspace,
            [
                {"type": "http_request", "method": "GET", "url": "https://example.com/a"},
                {"type": "http_request", "method": "GET", "url": "https://example.com/b"},
                {"type": "http_request", "method": "GET", "url": "https://example.com/c"},
            ],
            short_id="wrk0000012",
        )
        run = await create_run(scenario, {}, "manual", setup_db)
        run_id = run.id
        await setup_db.commit()

    async def handler(request):
        calls.append(str(request.url))
        if len(calls) == 1:
            # Stand in for a user's cancel request arriving from a real
            # request handler, in a real different session, while the
            # worker is mid-request on step 0.
            async with factory() as cancel_db:
                target = await cancel_db.get(ScenarioRun, run_id)
                assert await cancel_run(target, cancel_db) is True
                await cancel_db.commit()
        return httpx.Response(200, json={})

    # The worker: claims and marks the run running in its own session, then
    # commits the claim, exactly as run_once does. Cleanup is explicit in
    # `finally` on the failure path too, so an assertion failure here can't
    # leave a session open mid-transaction holding row locks that block every
    # later test's teardown in the same database.
    worker_db = factory()
    try:
        claimed = await claim_next_run(worker_db)
        assert claimed is not None
        await mark_running(claimed, worker_db)
        await worker_db.commit()

        status = await execute_run(claimed, worker_db, client=_client(handler))

        assert status == "cancelled"
        # Only the first request — the one already in flight when the
        # cancellation landed — should ever have been sent.
        assert calls == ["https://example.com/a"]
    finally:
        await worker_db.rollback()
        await worker_db.close()


@pytest.mark.asyncio
async def test_a_step_result_is_visible_to_another_session_before_the_run_finishes(
    db_engine, test_workspace
):
    """`run_once` commits the claim, and the next commit was `_loop`'s, after
    `execute_run` returned — so every `record_step_result` in between stayed
    uncommitted for the run's whole duration. `GET .../runs/{id}` therefore
    reported `status: "running", step_results: []` no matter how many steps
    had already completed, which makes the polling API useless for progress.
    """
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    seen = {}

    async with factory() as setup_db:
        scenario = await _scenario(
            setup_db,
            test_workspace,
            [
                {"type": "http_request", "method": "GET", "url": "https://example.com/a"},
                {"type": "http_request", "method": "GET", "url": "https://example.com/b"},
            ],
            short_id="wrk0000013",
        )
        run = await create_run(scenario, {}, "manual", setup_db)
        run_id = run.id
        await setup_db.commit()

    async def handler(request):
        if str(request.url).endswith("/b"):
            # A separate session, standing in for a concurrent GET
            # .../runs/{id} while the worker is still mid-run on step 1.
            async with factory() as check_db:
                run_row = await check_db.get(ScenarioRun, run_id)
                seen["run_status"] = run_row.status
                rows = (
                    await check_db.execute(
                        select(ScenarioStepResult)
                        .where(ScenarioStepResult.run_id == run_id)
                    )
                ).scalars().all()
                seen["committed_step_indexes"] = sorted(r.step_index for r in rows)
        return httpx.Response(200, json={})

    worker_db = factory()
    try:
        claimed = await claim_next_run(worker_db)
        assert claimed is not None
        await mark_running(claimed, worker_db)
        await worker_db.commit()

        status = await execute_run(claimed, worker_db, client=_client(handler))

        assert status == "passed"
        # Step 0's result was durable — visible to a wholly separate
        # session — before step 1 even started, and the run was still
        # "running" at that point, not yet finished.
        assert seen["run_status"] == "running"
        assert seen["committed_step_indexes"] == [0]
    finally:
        await worker_db.rollback()
        await worker_db.close()
