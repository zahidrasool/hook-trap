import ipaddress
import socket

import httpx
import pytest
from sqlalchemy import select

from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult
from app.services.scenario_run_service import create_run
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
