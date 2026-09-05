"""Design SCENARIOS_DESIGN.md section 1's example, end to end.

One scenario, four steps: call the application, deliver a webhook to it, wait
for one to come back, then wait for the confirmation email. Every step type
already has its own unit tests; nothing yet proves they compose into the
workflow the product actually claims. This is that proof.

Timing is the hard part. Every wait finder in scenario_waits.py is scoped to
rows created strictly after the step's own `since` (pinned by
test_scenario_waits.py's boundary tests) -- that is what stops a webhook left
over from an earlier run satisfying a later wait, and it must not be relaxed.
So the capture and the email have to be committed *during* their respective
waits, not before the run begins.

This test uses a concurrent inserter task, following the established pattern
in test_scenario_waits.py's
test_wait_for_webhook_sees_a_capture_committed_by_a_different_session: a task
opens its own session from `async_sessionmaker(db_engine, ...)`, sleeps
briefly, inserts the WebhookCapture, commits, sleeps again, inserts the
InboxEmail, commits -- all while the run's own session sits mid-poll in its
own open transaction, exactly as a real webhook delivery or inbound email
would land through an entirely separate request handler. Both waits are given
a generous 5s timeout so ordinary scheduling jitter on a loaded machine cannot
turn this into a flaky test: the two inserts only need to land within a few
hundred milliseconds, nowhere near that ceiling.

(The alternative -- stamping captured_at/received_at a bit into the future and
inserting before the run starts -- was not used here: it requires guessing
that the future offset outruns however long steps 0 and 1 take to execute,
where the concurrent-task approach instead reacts to the run's actual
progress and proves the cross-session polling path this feature depends on in
production.)
"""

import asyncio
import ipaddress
import json
import socket

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.inbox_email import InboxEmail
from app.models.scenario import ScenarioStepResult
from app.models.webhook import WebhookCapture
from app.services.scenario_run_service import claim_next_run, create_run, mark_running
from app.services.scenario_service import create_scenario, get_capture_endpoint
from app.services.scenario_worker import execute_run


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Hostnames resolve to one public address; IP literals resolve to
    themselves. Mirrors the fixture of the same name in test_scenario_worker.py
    so the SSRF guard lets the mocked outbound calls through without any real
    DNS lookup or network access.
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


@pytest.mark.asyncio
async def test_the_full_workflow_calls_delivers_waits_and_confirms(
    db_engine, test_workspace, test_user
):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as setup_db:
        scenario = await create_scenario(test_workspace, "Checkout", None, test_user, setup_db)
        scenario.steps = [
            {
                "type": "http_request",
                "method": "POST",
                "url": "https://example.com/api/orders",
                "body": {"amount": 100},
                "assert": ["status == 200"],
                "capture": {"orderId": "response.body.orderId"},
            },
            {
                "type": "send_webhook",
                "url": "https://example.com/webhooks/incoming",
                "event": "order.created",
                "body": {"orderId": "{{orderId}}"},
                "assert": ["status == 200"],
            },
            {
                "type": "wait_for_webhook",
                "timeout_seconds": 5,
                "match": {"body.event": "invoice.paid"},
                "capture": {"invoiceId": "body.invoiceId"},
            },
            {
                "type": "wait_for_email",
                "to": "buyer@example.com",
                "timeout_seconds": 5,
            },
        ]
        await setup_db.flush()

        endpoint = await get_capture_endpoint(scenario.id, setup_db)
        endpoint_id = endpoint.id
        workspace_id = test_workspace.id

        run = await create_run(scenario, {}, "manual", setup_db)
        run_id = run.id
        await setup_db.commit()

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.endswith("/api/orders"):
            return httpx.Response(200, json={"orderId": "ord_789"})
        if url.endswith("/webhooks/incoming"):
            return httpx.Response(200, json={"received": True})
        return httpx.Response(404, json={"error": f"unexpected url {url}"})

    async def deliver_the_webhook_and_email():
        """Stands in for the customer's system POSTing back to our capture
        endpoint, and for the confirmation email arriving in the workspace
        inbox -- both from separate sessions that commit and disappear while
        the run's own session is still mid-poll on the corresponding wait
        step. Releasing each session via `async with` as soon as its one
        insert is committed mirrors the cross-session test in
        test_scenario_waits.py.
        """
        await asyncio.sleep(0.3)
        async with factory() as sender_db:
            sender_db.add(
                WebhookCapture(
                    endpoint_id=endpoint_id,
                    http_method="POST",
                    headers={},
                    body=json.dumps({"event": "invoice.paid", "invoiceId": "inv_1"}),
                )
            )
            await sender_db.commit()

        await asyncio.sleep(0.3)
        async with factory() as sender_db:
            sender_db.add(
                InboxEmail(
                    workspace_id=workspace_id,
                    from_address="billing@example.com",
                    to_addresses=["buyer@example.com"],
                    subject="Payment confirmed",
                    text_body="Thanks for your payment.",
                )
            )
            await sender_db.commit()

    sender_task = asyncio.create_task(deliver_the_webhook_and_email())

    # Opened outside an `async with` because the assertions below need a
    # separate, wholly fresh session to read back the durable state -- and
    # cleanup is explicit in `finally` so a failure here can't leave a session
    # open mid-transaction, holding row locks that would block every later
    # test's teardown in the same database.
    worker_db = factory()
    try:
        try:
            claimed = await claim_next_run(worker_db)
            assert claimed is not None
            await mark_running(claimed, worker_db)
            await worker_db.commit()

            client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            try:
                status = await execute_run(claimed, worker_db, client=client)
            finally:
                await client.aclose()
        finally:
            # Always awaited, even if execute_run raised, so a failed
            # assertion never leaves this task running past the test.
            await sender_task
    finally:
        await worker_db.rollback()
        await worker_db.close()

    assert status == "passed"

    async with factory() as check_db:
        results = (
            (
                await check_db.execute(
                    select(ScenarioStepResult)
                    .where(ScenarioStepResult.run_id == run_id)
                    .order_by(ScenarioStepResult.step_index)
                )
            )
            .scalars()
            .all()
        )

    assert [r.step_type for r in results] == [
        "http_request",
        "send_webhook",
        "wait_for_webhook",
        "wait_for_email",
    ]
    assert [r.status for r in results] == ["passed", "passed", "passed", "passed"], [
        r.error for r in results
    ]

    # The waits' matched_id is what lets a run report show *which* webhook and
    # *which* email actually satisfied them -- not just that something did.
    assert results[2].matched_id is not None
    assert results[3].matched_id is not None
    assert results[2].captured == {"invoiceId": "inv_1"}

    # orderId, captured out of step 0's response body, reached step 1's own
    # request body -- proving the run's variable namespace actually threads
    # from one step to the next rather than each step running in isolation.
    assert results[0].captured == {"orderId": "ord_789"}
    assert results[1].request["body"] == {"orderId": "ord_789"}
