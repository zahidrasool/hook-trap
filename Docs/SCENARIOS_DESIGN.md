# Scenarios — Design

Status: draft for review
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
| `name` | varchar(200) | |
| `slug` | varchar(120) | unique per workspace; what the CLI addresses |
| `description` | text | nullable |
| `steps` | jsonb | ordered array, see §4 |
| `variables` | jsonb | defaults, overridable per run |
| `timeout_seconds` | int | whole-run ceiling, default 120 |
| `is_active` | bool | default true |
| `created_by` | uuid | fk → `users` |

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
third-party provider. Signature support (§8) hangs off this step.

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

Blocks until a request arrives on one of the workspace's capture endpoints.

```yaml
- type: wait_for_webhook
  endpoint: abc123          # capture endpoint short_id
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

## 5. Variables

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

## 6. Assertions

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

## 7. Execution model

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

## 8. Webhook signing

`send_webhook` supports the schemes customers actually receive:

| scheme | header | construction |
| --- | --- | --- |
| `stripe` | `Stripe-Signature` | `t=<ts>,v1=<hmac_sha256(ts + "." + body)>` |
| `github` | `X-Hub-Signature-256` | `sha256=<hmac_sha256(body)>` |
| `shopify` | `X-Shopify-Hmac-Sha256` | base64 `hmac_sha256(body)` |
| `hmac_sha256` | configurable | raw hex |

`sign.invalid: true` deliberately corrupts the signature, so a customer can test
that their endpoint *rejects* bad signatures — the check most people forget.

## 9. Security

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

## 10. API surface

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

## 11. CI runner

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

## 12. Quotas

Runs are billable work. Add `scenario_runs` as a fourth meter alongside the
existing three, enforced through the same `consume_quota` helper.

Suggested: Free 100/month, Pro 5,000, Team 50,000. Steps are not metered
separately in v1; a run is a run.

## 13. Scope

**v1 — the slice worth building first**

- Three tables, five step types, the assertion set in §6
- Variable capture and interpolation
- Sequential worker with pub/sub + polling waits
- SSRF guard applied to scenarios *and* retrofitted to replay
- Run detail UI showing per-step request, response, and assertions
- YAML export/import

**v2**

- `send_webhook` signing schemes (§8) and `sign.invalid`
- Environments (#6) seeding the variable namespace
- CLI and CI output (#3)
- Convert a captured webhook into a scenario step, one click (#9)

**Later**

- Branching, conditionals, retries
- Parallel steps
- Scheduled runs

## 14. Open questions

1. **Scenario-scoped mocks.** Should a scenario be able to override a mock
   endpoint's response for the duration of a run ("during this scenario,
   `/payments` returns 500")? It makes chaos scenarios far more expressive, but
   introduces per-run mock state and a concurrency problem when two runs of the
   same scenario overlap. Leaning toward deferring, but it affects whether
   `mock_endpoints` needs a run-scoped overlay table.

2. **Concurrent runs of one scenario.** Allow, or queue? Allowing risks two runs
   consuming each other's awaited webhooks despite the after-start-time filter.
   Simplest v1 answer: serialise per scenario, parallelise across scenarios.

3. **How long to keep run history.** Step results with full payloads will
   dominate storage quickly. Ties into the retention job that is still
   outstanding.
