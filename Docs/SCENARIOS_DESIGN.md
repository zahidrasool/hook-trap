# Scenarios — Design

Status: reviewed — open questions 1 and 2 settled 2026-09-04 (§15)
Scope: the scenario engine, assertions, and variable chaining as one feature

## 1. Why this, and what it is

MockLane has three capabilities that are useful individually: mock APIs, webhook
capture, and email sandboxes. A scenario connects them into one verifiable
workflow:

```
Scenario: successful checkout
  1. POST /payments to the app        → expect 200, capture paymentId
  2. wait 2s, deliver payment.completed webhook
  3. wait for the app to call our capture URL
  4. wait for a confirmation email
  5. assert on all three
```

That combination is the defensible part of the product. A competitor can build
mock APIs or a webhook inspector; the workflow across all three requires having
built all three first.

### Non-goals for v1

- Parallel or branching steps. Sequential only.
- Load testing. A run is one pass, not N concurrent.
- Scheduled/cron runs. Runs are triggered manually or by CI.
- Editing scenarios collaboratively in real time.

## 2. The decision that shapes everything: where scenarios live

Two viable models:

**File-first** — a YAML file in the customer's repo is the source of truth. Good
for CI and code review, bad for onboarding (empty text editor, no discovery).

**DB-first** — the scenario lives in MockLane, edited in the UI. Good for
onboarding, awkward for CI (tests not versioned alongside the code they test).

**Decision: DB is the store, YAML is the interchange format.**

- Scenarios are rows, edited in the UI, and that is what the API runs.
- Every scenario exports to YAML and imports back (`mocklane pull` / `push`).
- The CLI can also run a local YAML file directly without storing it, for the
  "tests live in my repo" workflow.

This avoids the sync problem that comes from having two sources of truth, while
still supporting both workflows. Deciding this later would mean rewriting the
schema, which is why it is settled here.

## 3. Data model

Three new tables. Names follow the existing convention (UUID pk, `created_at`,
`updated_at` from `BaseModel`).

### `scenarios`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid | pk |
| `workspace_id` | uuid | fk → `workspaces`, cascade delete |
| `short_id` | varchar(12) | unique, globally; the scenario's own URL namespace (§5) |
| `name` | varchar(200) | |
| `slug` | varchar(120) | unique per workspace; what the CLI addresses |
| `description` | text | nullable |
| `steps` | jsonb | ordered array, see §4 |
| `variables` | jsonb | defaults, overridable per run |
| `timeout_seconds` | int | whole-run ceiling, default 120 |
| `is_active` | bool | default true |
| `created_by` | uuid | fk → `users` |

Two **existing** tables each gain a nullable `scenario_id` column rather than
getting a new table of their own:

- `mock_endpoints.scenario_id` — a mock owned by one scenario instead of shared
  across the workspace.
- `endpoints.scenario_id` — the capture endpoint allocated to a scenario.

Both are `NULL` for everything that exists today, so the migration is additive
and nothing changes for current users. §5 explains why.

Steps live in a `jsonb` column rather than a `scenario_steps` table. They are
always read and written as a whole ordered document, never queried individually,
and keeping them inline makes edit-and-save atomic. If step-level querying is
ever needed, that is the point to normalise.

### `scenario_runs`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid | pk |
| `scenario_id` | uuid | fk → `scenarios` |
| `workspace_id` | uuid | denormalised, for quota and listing queries |
| `status` | varchar(20) | `pending` `running` `passed` `failed` `error` `timeout` `cancelled` |
| `trigger` | varchar(20) | `manual` `api` `ci` |
| `variables` | jsonb | resolved inputs for this run |
| `started_at` / `finished_at` | timestamptz | nullable |
| `duration_ms` | int | nullable |
| `error` | text | engine-level failure, distinct from an assertion failing |

`workspace_id` is denormalised deliberately: run listing and quota counting are
the two hottest queries and both would otherwise join through `scenarios`.

### `scenario_step_results`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid | pk |
| `run_id` | uuid | fk → `scenario_runs`, cascade delete |
| `step_index` | int | position in the scenario |
| `step_type` | varchar(30) | |
| `status` | varchar(20) | `passed` `failed` `skipped` `error` `timeout` |
| `started_at` / `finished_at` | timestamptz | |
| `request` | jsonb | what we sent, nullable |
| `response` | jsonb | what we got, nullable |
| `matched_id` | uuid | the capture/email row that satisfied a wait, nullable |
| `assertions` | jsonb | per-assertion pass/fail with actual values |
| `captured` | jsonb | variables extracted at this step |
| `error` | text | nullable |

Storing request and response per step is what makes a failed run debuggable.
That is the whole value of the feature — a red X with no payload is useless.

## 4. Step contract

Every step is an object with `type`, an optional `name`, and type-specific
fields. v1 ships five types.

### `http_request`

Calls an external URL — the customer's application.

```yaml
- type: http_request
  name: Create payment
  method: POST
  url: "{{baseUrl}}/payments"
  headers:
    Content-Type: application/json
  body:
    amount: 4900
  timeout_seconds: 30
  capture:
    paymentId: response.body.paymentId
  assert:
    - status == 200
    - response.body.paymentId exists
    - response.time_ms < 2000
```

### `delay`

```yaml
- type: delay
  seconds: 2
```

### `send_webhook`

Delivers a webhook *to the customer's endpoint*, i.e. MockLane acting as the
third-party provider. Signature support (§9) hangs off this step.

```yaml
- type: send_webhook
  url: "{{appUrl}}/webhooks/payment"
  event: payment.completed
  body:
    paymentId: "{{paymentId}}"
  sign:
    scheme: stripe          # stripe | github | shopify | hmac_sha256 | none
    secret: "{{webhookSecret}}"
  assert:
    - status == 200
```

### `wait_for_webhook`

Blocks until a request arrives on the scenario's own capture endpoint (§5).
`endpoint` is optional and only needed to wait on a different one.

```yaml
- type: wait_for_webhook
  endpoint: abc123          # optional; defaults to this scenario's endpoint
  timeout_seconds: 10
  match:
    body.event: payment.completed
  capture:
    receivedAt: captured_at
  assert:
    - body.event == "payment.completed"
    - received_within 10s
```

### `wait_for_email`

Blocks until a message arrives in the workspace inbox or a sandbox.

```yaml
- type: wait_for_email
  to: "{{customerEmail}}"
  timeout_seconds: 30
  assert:
    - subject contains "Payment confirmed"
    - body contains "{{paymentId}}"
```

## 5. Scenario URLs

**Decision: every scenario gets its own URL namespace. Scenarios never mutate
shared mock endpoints.**

The alternative considered and rejected was a run-scoped overlay — "for the
duration of this run, `/payments` returns 500". It reads well and is a trap: it
puts mutable per-run state in front of the mock serving path, and two overlapping
runs of the same scenario would fight over it. Worse, a run that dies mid-flight
leaves the workspace's real mocks altered, which is the kind of bug that costs
trust in a testing product.

A scenario gets a `short_id` at creation, and with it two addresses.

### Mocks

```
/m/{workspace_short_id}/{path}     shared mocks, unchanged
/s/{scenario_short_id}/{path}      scenario-scoped
```

`/s/` resolves in two passes: mocks carrying this `scenario_id` first, then the
workspace's shared mocks as a fallback. A scenario therefore overrides only what
it explicitly defines and inherits everything else.

This reuses the entire existing mock pipeline — rules, sequences, templates,
error simulation, logging — by changing the lookup filter in
`get_active_mocks_for_workspace`, not by adding a parallel serving path. The
quota charge, privacy check and CORS behaviour of `/m/` apply identically.

"Return 500 during this scenario" then becomes a scenario-scoped mock with
`error_rate: 1.0`: static configuration, no run state, no concurrency problem.

### Webhook capture

Each scenario also owns a capture endpoint (`endpoints.scenario_id`), giving it a
dedicated `/h/{endpoint_short_id}`. `wait_for_webhook` defaults to it, so a
scenario waits on traffic that is definitionally its own — no other scenario, and
no manual poking at the workspace, can land a request there.

### What this buys

- No per-run state anywhere in the serving path.
- Isolation solved by addressing rather than by locking.
- A staging environment pointed at `/s/{scenario_short_id}` behaves the way that
  scenario expects with or without a run in progress, which makes a scenario's
  mocks demonstrable outside a run.

The one ambiguity left is *concurrent runs of the same scenario*, which share a
namespace. Settled in §8.

## 6. Variables

One namespace per run, seeded from (in increasing precedence): workspace
environment defaults → scenario `variables` → values supplied at trigger time.

- Interpolation is `{{name}}`, matching the existing template engine's syntax so
  users learn one thing. Reuse `process_template` where possible.
- `capture` on a step writes into the namespace using a dotted path against that
  step's result (`response.body.id`, `headers.X-Request-Id`, `captured_at`).
- An unresolved `{{var}}` is a step **error**, not a silent empty string.
  Silently substituting nothing produces confusing downstream failures.

Environments (#6 on the roadmap) become a table of named variable sets that
seed this namespace. Not in v1, but the precedence order above is designed so
they drop in without a schema change.

## 7. Assertions

A deliberately small set, expressed as strings and parsed into a structured
form. Strings keep the YAML readable; parsing keeps results machine-checkable.

| form | example |
| --- | --- |
| comparison | `status == 200`, `response.time_ms < 2000` |
| existence | `response.body.paymentId exists` |
| containment | `subject contains "Payment"` |
| timing | `received_within 10s` |
| equality on path | `body.event == "payment.completed"` |

Each evaluates to `{assertion, passed, expected, actual}` so the UI and CI
output can show *why* something failed, not just that it did.

**A failed assertion fails the step and the run, but the run continues** to
execute remaining steps by default, so one report shows every problem rather
than only the first. `stop_on_failure: true` on a step overrides this where a
later step is meaningless without an earlier one.

## 8. Execution model

### Where runs execute

A dedicated worker, not the request path. A run holds state for seconds to
minutes; occupying a uvicorn worker for that would starve the API under a
handful of concurrent runs.

v1: an `asyncio` task started in the FastAPI lifespan, pulling queued runs from
Postgres with `SELECT ... FOR UPDATE SKIP LOCKED`. This avoids adding a broker
on a 2 GB instance that already runs Postgres, Redis, Caddy, and two apps.

The queue is a table, not Redis, because a run must survive a restart. Redis is
explicitly optional everywhere else in this codebase and must stay that way.

When the box gets busy, the upgrade path is a separate worker process against
the same table — no schema change.

### Concurrency

**Decision: runs of the same scenario are queued; different scenarios run in
parallel.**

Steps within a run are interdependent by construction — step 3 waits for a
webhook that step 1 provoked, using variables step 1 captured — and the scenario
namespace from §5 is shared by every run of that scenario. Two overlapping runs
would contend for both.

So the claim query takes the oldest `pending` run *whose scenario has no run
currently `running`*:

```sql
SELECT r.* FROM scenario_runs r
WHERE r.status = 'pending'
  AND NOT EXISTS (
        SELECT 1 FROM scenario_runs x
        WHERE x.scenario_id = r.scenario_id AND x.status = 'running')
ORDER BY r.created_at
FOR UPDATE OF r SKIP LOCKED
LIMIT 1;
```

The parallelism that matters — a CI job running twenty different scenarios — is
untouched, since the constraint is per scenario, not global.

Two consequences to handle rather than discover:

- A queued run's wait is not free; `timeout_seconds` must start at `started_at`,
  not at creation, or a queue backlog reads as a test failure.
- A crashed worker must not block a scenario forever. Runs `running` past the
  whole-run ceiling are swept to `timeout` by the same loop.

### Lifecycle

```
pending ──▶ running ──▶ passed
                    ├─▶ failed     (an assertion failed)
                    ├─▶ error      (engine or network fault)
                    ├─▶ timeout    (whole-run ceiling hit)
                    └─▶ cancelled  (user)
```

`failed` and `error` are kept distinct on purpose: "your app returned the wrong
status" and "we could not reach your app" are different problems and CI should
be able to tell them apart.

### Waiting on inbound events

`wait_for_webhook` and `wait_for_email` need to know when something arrives.
Both write paths already exist and already publish to Redis for live dashboard
updates, so:

1. On entering a wait step, the worker records what it is waiting for.
2. The capture handler and the SMTP handler publish on arrival (as today).
3. The worker subscribes, and **also polls the table every 500 ms**.

The poll is not redundant. Redis is optional here, and a scenario that hangs
because the cache is down would be a bad failure mode. Pub/sub is the fast path;
polling is the guarantee.

Matching is scoped to rows created **after the step started**, so a webhook from
a previous run cannot satisfy a later wait.

## 9. Webhook signing

`send_webhook` supports the schemes customers actually receive:

| scheme | header | construction |
| --- | --- | --- |
| `stripe` | `Stripe-Signature` | `t=<ts>,v1=<hmac_sha256(ts + "." + body)>` |
| `github` | `X-Hub-Signature-256` | `sha256=<hmac_sha256(body)>` |
| `shopify` | `X-Shopify-Hmac-Sha256` | base64 `hmac_sha256(body)` |
| `hmac_sha256` | configurable | raw hex |

`sign.invalid: true` deliberately corrupts the signature, so a customer can test
that their endpoint *rejects* bad signatures — the check most people forget.

## 10. Security

Scenarios make outbound HTTP routine rather than user-triggered, so SSRF stops
being theoretical. `replay_service` already makes outbound calls today with no
restriction; that gap gets closed here and should be applied to replay too.

Before any `http_request` or `send_webhook`:

- Resolve the hostname and **reject private, loopback, link-local and reserved
  ranges** — notably `169.254.169.254`, which on EC2 is the instance metadata
  service and would expose the instance role's credentials.
- Re-check after redirects; follow at most 3, and never to a rejected address.
- Allow `http`/`https` only.
- Cap response body retention at 256 KB per step; larger responses are asserted
  against but stored truncated.

An allowlist per workspace is the natural v2 hardening.

## 11. API surface

```
GET    /api/v1/workspaces/{short_id}/scenarios
POST   /api/v1/workspaces/{short_id}/scenarios
GET    /api/v1/workspaces/{short_id}/scenarios/{slug}
PATCH  /api/v1/workspaces/{short_id}/scenarios/{slug}
DELETE /api/v1/workspaces/{short_id}/scenarios/{slug}

POST   /api/v1/workspaces/{short_id}/scenarios/{slug}/run     → 202 {run_id}
GET    /api/v1/workspaces/{short_id}/runs/{run_id}            → run + step results
POST   /api/v1/workspaces/{short_id}/runs/{run_id}/cancel

GET    /api/v1/workspaces/{short_id}/scenarios/{slug}/export  → YAML
POST   /api/v1/workspaces/{short_id}/scenarios/import         → YAML in, scenario out
```

Run creation returns `202` immediately with a `run_id`; the client polls or
subscribes. A synchronous run endpoint is tempting for CI but would tie up a
worker for the run's duration.

## 12. CI runner

Falls out of the engine almost for free, which is why the engine comes first.

```bash
mocklane run checkout-success --api-key $MOCKLANE_KEY
```

POSTs a run, polls until terminal, prints a summary, exits non-zero on
`failed`/`error`/`timeout`. Roughly:

```
MockLane Integration Tests

✓ Login                    1.2s
✓ Successful checkout      3.7s
✗ Duplicate webhook        5.1s
    body.event == "payment.completed"
      expected: payment.completed
      actual:   payment.failed

4 passed, 1 failed
```

Ship the CLI as a single binary or an `npx` package — a `pip install` dependency
in someone's Node CI is friction that costs adoption.

## 13. Quotas

Runs are billable work. Add `scenario_runs` as a fourth meter alongside the
existing three, enforced through the same `consume_quota` helper.

Suggested: Free 100/month, Pro 5,000, Team 50,000. Steps are not metered
separately in v1; a run is a run.

## 14. Scope

**v1 — the slice worth building first**

- Three tables, five step types, the assertion set in §7
- Scenario URL namespace and scenario-scoped mocks (§5, §16)
- Variable capture and interpolation
- Sequential worker with pub/sub + polling waits
- SSRF guard applied to scenarios *and* retrofitted to replay
- Run detail UI showing per-step request, response, and assertions
- YAML export/import

**v2**

- `send_webhook` signing schemes (§9) and `sign.invalid`
- Environments (#6) seeding the variable namespace
- CLI and CI output (#3)
- Convert a captured webhook into a scenario step, one click (#9)

**Later**

- Branching, conditionals, retries
- Parallel steps
- Scheduled runs

## 15. Decisions and what is still open

Resolved on review, 2026-09-04:

1. **Scenario-scoped mocks — resolved as scenario URLs, not run overlays.**
   A scenario gets its own `short_id` and serves at `/s/{scenario_short_id}`,
   overriding only the mocks it defines and inheriting the rest. Nothing is
   mutated for the duration of a run. See §5.

2. **Concurrent runs of one scenario — queued.** Steps in a run are
   interdependent and runs of one scenario share its namespace, so they
   serialise; different scenarios still run in parallel. See §8.

Still open:

3. **How long to keep run history.** Deliberately deferred. Step results carry
   full request and response payloads and will dominate storage well before
   anything else does, but the number is easier to pick with real data than in
   advance. Two things follow from leaving it open:

   - The 256 KB per-step cap (§10) is the interim guard, and matters more
     because of this — it bounds the worst case while the policy is undecided.
   - `scenario_step_results` cascades from `scenario_runs`, so whatever policy
     lands is a delete against one table. No schema change is being deferred
     here, only a number.

   This joins the retention work already outstanding for captures, mock request
   logs and emails; all four should be handled by one job rather than four.

## 16. Scope changes from this review

The URL decision in §5 is additive but not free. It adds to v1:

- `short_id` on `scenarios`, and a nullable `scenario_id` on `mock_endpoints`
  and `endpoints` (all additive; existing rows are unaffected).
- A `/s/{scenario_short_id}/{path}` route reusing `mock_serve`, with a two-pass
  lookup — scenario mocks first, workspace mocks as fallback.
- UI for attaching a mock to a scenario rather than to the workspace.
- Auto-allocating a capture endpoint when a scenario is created.

It removes a run-scoped overlay table, per-run mock state, and the cleanup path
for a run that dies holding an override. That is a good trade: the work moves
from runtime state, which fails in ways that are hard to reproduce, to schema
and routing, which fail loudly at build time.
