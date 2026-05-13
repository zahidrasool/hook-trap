# HookTrap Revenue Model & Mock API Strategy

> This document extends the HookTrap product plan with a detailed revenue model and integrates the **Mock APIs** feature — transforming HookTrap from a webhook testing tool into a **Backend-Frontend Collaboration Platform**.

---

## 1. The Strategic Shift: Why Mock APIs Change Everything

### Before Mock APIs
HookTrap = **Webhook Testing Sandbox** (catches incoming webhooks)
- Solves: "I need to test my Stripe/GitHub webhook integration"
- User: Backend developer working alone
- Revenue ceiling: Niche testing tool (~$5K-$10K MRR)

### After Mock APIs
HookTrap = **API Collaboration Platform** (catches webhooks + serves mock APIs)
- Solves: "My frontend team is blocked waiting for the backend API"
- User: Entire development team (backend + frontend + QA)
- Revenue ceiling: Team collaboration tool (~$50K-$100K+ MRR)

### Why This Matters

The mock API feature turns HookTrap from a **solo developer tool** into a **team tool**. This is the single most important revenue lever because:

1. **Teams pay, individuals don't.** Solo devs tolerate free tools forever. Teams pay because coordination costs real money (blocked sprints, mismatched contracts, integration bugs).

2. **Seats multiply revenue.** A webhook sandbox has 1 user per endpoint. A mock API server has 5-10 users per project (backend devs defining the API, frontend devs consuming it, QA testing against it).

3. **It's the same infrastructure.** A webhook capture endpoint and a mock API endpoint are both HTTP endpoints that receive requests and return responses. The difference is configuration: webhooks capture and store, mocks match and respond. You're reusing 80% of the same codebase.

4. **Natural discovery loop.** Backend dev uses HookTrap for webhook testing → realizes they can also create mock endpoints for the frontend team → invites teammates → team upgrades to paid plan.

---

## 2. Product Feature Map (with Mock APIs)

```
┌─────────────────────────────────────────────────────────┐
│                     HOOKTRAP                             │
├──────────────────────┬──────────────────────────────────┤
│   CAPTURE MODE       │   MOCK MODE                      │
│   (Webhook Sandbox)  │   (Mock API Server)              │
├──────────────────────┼──────────────────────────────────┤
│ • Catch webhooks     │ • Define mock endpoints          │
│ • Inspect payloads   │ • Set response rules             │
│ • Replay to local    │ • Dynamic responses (templates)  │
│ • Payload diffing    │ • Request matching (path, body)  │
│ • cURL export        │ • Latency simulation             │
│ • Share sessions     │ • Error simulation (4xx, 5xx)    │
│                      │ • Stateful sequences             │
│                      │ • OpenAPI import                 │
│                      │ • Collaboration (shared mocks)   │
│                      │ • API contract validation        │
└──────────────────────┴──────────────────────────────────┘
              │                        │
              └──────────┬─────────────┘
                         ▼
              ┌──────────────────────┐
              │   SHARED FEATURES    │
              ├──────────────────────┤
              │ • Unique URLs        │
              │ • Real-time dashboard│
              │ • Team workspaces    │
              │ • Request logging    │
              │ • Analytics          │
              │ • API/SMTP notifs    │
              └──────────────────────┘
```

### Mock API Feature: Detailed Requirements

#### Core Mock Features (Pro Tier)

**1. Define Mock Endpoints**
```
User creates a mock endpoint:
  URL:      https://hooktrap.dev/m/{workspace_id}/api/users
  Method:   GET
  Response: {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      "users": [
        { "id": 1, "name": "Alice", "email": "alice@example.com" },
        { "id": 2, "name": "Bob", "email": "bob@example.com" }
      ]
    }
  }
```
Frontend developer can now call this URL and get a predictable response — no backend needed.

**2. Dynamic Response Templates**
Support template variables in mock responses using Handlebars-style syntax:
```json
{
  "id": "{{randomUUID}}",
  "name": "{{request.query.name}}",
  "created_at": "{{now}}",
  "request_path": "{{request.path}}",
  "request_body": "{{request.body.email}}"
}
```

Built-in template helpers:
- `{{randomUUID}}` — generates a random UUID
- `{{randomInt min max}}` — random integer in range
- `{{randomName}}` — realistic fake name
- `{{randomEmail}}` — realistic fake email
- `{{now}}` — current ISO timestamp
- `{{now offset="+1h"}}` — timestamp with offset
- `{{request.path}}` — echo the request path
- `{{request.query.paramName}}` — echo a query parameter
- `{{request.body.fieldName}}` — echo a body field
- `{{request.headers.headerName}}` — echo a header value
- `{{faker.address.city}}` — Faker.js-style data generation

**3. Request Matching Rules**
When multiple mock routes could match, use rules to pick the right response:

```yaml
Route: POST /api/users
Rules:
  - match:
      body.role: "admin"
    respond:
      status: 403
      body: { "error": "Cannot create admin users via API" }

  - match:
      body.email: "*.test.com"
    respond:
      status: 201
      body: { "id": "{{randomUUID}}", "email": "{{request.body.email}}", "test": true }

  - default:
      status: 201
      body: { "id": "{{randomUUID}}", "email": "{{request.body.email}}" }
```

**4. Latency & Error Simulation**
```
Per-endpoint settings:
  - Delay: 0-10000ms (fixed or random range)
  - Error rate: 0-100% (randomly return configured error instead of normal response)
  - Error response: { status: 500, body: { "error": "Internal server error" } }
  - Timeout simulation: drop connection after X ms (no response)
```

**5. Stateful Sequences**
Mock endpoints that change behavior based on call count:
```
Sequence for: POST /api/payment
  Call 1: { status: 200, body: { "status": "pending" } }
  Call 2: { status: 200, body: { "status": "processing" } }
  Call 3: { status: 200, body: { "status": "completed" } }
  After:  Loop from call 1 (or stick at last response)
```

This lets frontend devs simulate multi-step workflows (payment flows, approval chains, polling).

#### Advanced Mock Features (Team Tier)

**6. OpenAPI / Swagger Import**
```
Upload an openapi.yaml or paste a URL →
HookTrap auto-generates mock endpoints for every path/method →
Responses use the schema's example values or generate realistic fake data from schema types
```

This is the killer feature for team adoption. Backend writes the OpenAPI spec, uploads it, and the frontend team immediately has a working mock server to build against.

**7. API Contract Validation**
When an OpenAPI spec is linked:
- Every request to the mock is validated against the spec
- Dashboard shows: "12 requests matched spec, 3 violated" with details
- Frontend team catches integration bugs before the real API exists

**8. Proxy Mode (pass-through with recording)**
```
Mock endpoint /api/users →
  If real backend is up: forward to http://real-backend:8000/api/users, record response
  If real backend is down: serve last recorded response (auto-fallback)
```

This lets teams gradually migrate from mocks to real APIs without changing frontend code.

---

## 3. Revenue Model: Hybrid Freemium + Usage-Based

### Pricing Philosophy

Based on what works for developer tools in 2026:

1. **Free tier must be genuinely useful** — developers need extended evaluation, not 14-day trials
2. **Upgrade trigger = team collaboration** — the moment a second person joins, the free tier should feel limiting
3. **Usage-based on the expensive axis** — charge for volume (requests) not features devs need to evaluate the tool
4. **Seat-based on the collaboration axis** — teams pay per seat because that's where value compounds

### Pricing Tiers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        HOOKTRAP PRICING                                 │
├─────────┬──────────┬──────────────┬───────────────┬────────────────────┤
│         │  FREE    │  PRO         │  TEAM         │  BUSINESS          │
│         │  $0      │  $14/mo      │  $49/mo       │  $149/mo           │
│         │          │  ($12 annual)│  ($39 annual) │  ($119 annual)     │
├─────────┼──────────┼──────────────┼───────────────┼────────────────────┤
│ WEBHOOK SANDBOX                                                        │
├─────────┼──────────┼──────────────┼───────────────┼────────────────────┤
│ Capture │ 3        │ 20           │ 50            │ Unlimited          │
│ Endpts  │          │              │               │                    │
│ Captures│ 100/day  │ Unlimited    │ Unlimited     │ Unlimited          │
│ /day    │          │              │               │                    │
│Retention│ 24 hours │ 30 days      │ 60 days       │ 90 days            │
│ Replay  │ —        │ Yes          │ Yes           │ Yes                │
│ Sharing │ —        │ View only    │ View + Replay │ Full control       │
├─────────┼──────────┼──────────────┼───────────────┼────────────────────┤
│ MOCK APIs                                                              │
├─────────┼──────────┼──────────────┼───────────────┼────────────────────┤
│ Mock    │ 2        │ 15           │ 50            │ Unlimited          │
│ Endpts  │          │              │               │                    │
│ Mock    │ 200/day  │ 10,000/day   │ 100,000/day   │ 1,000,000/day      │
│ Requests│          │              │               │                    │
│Templates│ Static   │ Static +     │ All + OpenAPI │ All + custom       │
│         │ only     │ Dynamic      │ import        │ functions          │
│ Latency │ —        │ Fixed delay  │ Full sim      │ Full sim           │
│ Sim     │          │              │               │                    │
│Sequences│ —        │ —            │ Yes           │ Yes                │
│Contract │ —        │ —            │ Yes           │ Yes + alerts       │
│Validate │          │              │               │                    │
│ Proxy   │ —        │ —            │ —             │ Yes                │
│ Mode    │          │              │               │                    │
├─────────┼──────────┼──────────────┼───────────────┼────────────────────┤
│ TEAM FEATURES                                                          │
├─────────┼──────────┼──────────────┼───────────────┼────────────────────┤
│ Seats   │ 1        │ 1            │ 5 included    │ 20 included        │
│         │          │              │ (+$8/extra)   │ (+$6/extra)        │
│Workspace│ —        │ —            │ Shared        │ Multi-workspace    │
│ Roles   │ —        │ —            │ Admin/Member  │ Admin/Editor/      │
│         │          │              │               │ Viewer             │
│ Audit   │ —        │ —            │ —             │ Yes                │
│ Log     │          │              │               │                    │
│ SSO     │ —        │ —            │ —             │ SAML/OIDC          │
│ Support │ Community│ Email        │ Priority      │ Dedicated +        │
│         │          │ (48h SLA)    │ (8h SLA)      │ Slack channel      │
├─────────┼──────────┼──────────────┼───────────────┼────────────────────┤
│ API ACCESS                                                             │
├─────────┼──────────┼──────────────┼───────────────┼────────────────────┤
│ REST API│ —        │ Yes          │ Yes           │ Yes                │
│ CLI Tool│ —        │ Yes          │ Yes           │ Yes                │
│Webhooks │ —        │ —            │ Notification  │ Full event         │
│ (meta)  │          │              │ webhooks      │ webhooks           │
│ Custom  │ —        │ —            │ —             │ Yes                │
│ Domain  │          │              │               │                    │
└─────────┴──────────┴──────────────┴───────────────┴────────────────────┘
```

### Why This Pricing Works

**Free → Pro conversion trigger:** Developer hits 100 captures/day or needs replay. These are the moments when they're actively debugging and most willing to pay.

**Pro → Team conversion trigger:** Developer invites a colleague or wants OpenAPI import for mock APIs. The jump from "my tool" to "our tool" is the natural upgrade moment.

**Team → Business conversion trigger:** Engineering manager wants SSO, audit logs, or custom domains. These are compliance-driven purchases with budget behind them.

---

## 4. Revenue Streams Breakdown

### Stream 1: Subscription Revenue (Primary — ~70% of total)

This is the core SaaS revenue from the tiered plans above.

**Revenue math at different scales:**

| Milestone | Free Users | Pro | Team | Business | MRR | ARR |
|-----------|-----------|-----|------|----------|-----|-----|
| Month 6   | 2,000 | 40 | 5 | 0 | $805 | $9.7K |
| Month 12  | 8,000 | 150 | 30 | 3 | $3,927 | $47.1K |
| Month 18  | 20,000 | 350 | 80 | 10 | $8,710 | $104.5K |
| Month 24  | 50,000 | 700 | 200 | 30 | $18,950 | $227.4K |

**Assumptions:**
- Free→Pro conversion: 2% (industry average for dev tools)
- Pro→Team conversion: 15% over 6 months
- Team→Business conversion: 8% over 12 months
- Monthly churn: Pro 5%, Team 3%, Business 2%

### Stream 2: Usage Overages (Secondary — ~15% of total)

For teams that exceed their tier's daily limits without wanting to upgrade to the next full tier.

**Overage pricing:**
| Resource | Price |
|----------|-------|
| Additional webhook captures | $2 per 10,000 |
| Additional mock API requests | $3 per 10,000 |
| Additional data retention (per 30 days) | $5/endpoint |
| Additional seats (Team) | $8/seat/month |
| Additional seats (Business) | $6/seat/month |

**Why this works:** It captures revenue from teams that are "in between" tiers. A team with 6 people on the Team plan pays $49 + $8 = $57/mo rather than jumping to $149/mo. This feels fair and reduces churn from sticker shock.

### Stream 3: Marketplace / Templates (Future — ~10% of total)

Once HookTrap has significant adoption, introduce a **template marketplace**:

**Webhook Templates:**
- Pre-built capture configurations for popular services
- "Stripe Webhooks Starter" — pre-configured endpoints matching all Stripe event types with example payloads
- "GitHub Actions Webhook Pack" — endpoints for all GitHub webhook events
- "Shopify Integration Kit" — endpoints + mock responses for Shopify API

**Mock API Templates:**
- "REST API Starter" — CRUD endpoints for a generic resource
- "Auth API Mock" — login, register, refresh token, OAuth flows
- "E-commerce API Mock" — products, cart, checkout, orders
- "Social Media API Mock" — posts, comments, likes, follow

**Revenue model:**
- Free templates: drive adoption
- Premium templates: $5-$15 one-time purchase
- Community marketplace: 70/30 revenue split (creator gets 70%)
- Enterprise template packs: $49-$99

### Stream 4: CLI / CI-CD Integration (Future — ~5% of total)

A `hooktrap` CLI tool that integrates with CI/CD pipelines:

```bash
# In CI/CD pipeline
hooktrap mock start --spec openapi.yaml --port 8080
npm run test:integration
hooktrap mock stop --report
```

**Revenue angle:** CLI is free, but CI/CD usage (headless mock servers, contract testing in pipelines) requires a Team+ plan. This is how mock APIs become infrastructure rather than just a development tool.

---

## 5. Monetization Timeline

```
Month 1-3: FREE ONLY
├── Goal: 500 MAU, build trust, collect feedback
├── Monetization: $0 (intentional)
├── Focus: Webhook capture + basic mock endpoints
└── Signal to watch: "Would you pay for X?" survey

Month 4-6: LAUNCH PRO TIER ($14/mo)
├── Goal: 40 paying Pro users ($560 MRR)
├── Trigger: Replay, unlimited captures, dynamic mock templates
├── Focus: Features that solo devs need daily
└── Signal to watch: Replay usage, daily active sessions

Month 7-9: LAUNCH TEAM TIER ($49/mo)
├── Goal: 15 Team accounts ($735 MRR) + growing Pro base
├── Trigger: OpenAPI import, shared workspaces, contract validation
├── Focus: Features that require >1 person
├── Total target MRR: $2,000-$3,000
└── Signal to watch: Invitations sent, workspace creation

Month 10-12: LAUNCH BUSINESS TIER ($149/mo)
├── Goal: 5 Business accounts ($745 MRR) + growing base
├── Trigger: SSO, audit logs, custom domains, proxy mode
├── Focus: Enterprise compliance needs
├── Total target MRR: $4,000-$5,000
└── Signal to watch: Inbound from engineering managers

Month 13-18: SCALE + EXPAND
├── Goal: $8,000-$10,000 MRR
├── Add: CLI tool, CI/CD integration, template marketplace
├── Add: Usage-based overages
├── Consider: Annual plans with 20% discount (improve cash flow)
└── Decision point: Go full-time if MRR > $6,000
```

---

## 6. Free Tier Strategy: The Growth Engine

The free tier is not a loss leader — it's the **distribution channel**. Here's exactly what to optimize:

### What's Free (and Why)

| Free Feature | Why It's Free |
|-------------|---------------|
| 3 webhook capture endpoints | Enough to test 1-2 integrations (Stripe + GitHub) |
| 100 captures/day | Enough for active development, not enough for a team |
| 2 mock API endpoints | Enough to try mock APIs, not enough for a real project |
| 200 mock requests/day | Enough to see value, not enough for a frontend team |
| 24-hour retention | Forces daily engagement (they come back every day) |
| No signup for first endpoint | Zero friction first experience |

### What's NOT Free (and Why)

| Paid Feature | Why It's Paid |
|-------------|---------------|
| Replay | High-value debugging moment (willing to pay) |
| Dynamic mock templates | Requires investment to use (they're committed) |
| OpenAPI import | Team feature (teams have budget) |
| Sharing | Team feature |
| 30+ day retention | Storage cost + indicates serious usage |
| >100 captures/day | Volume = team = willing to pay |

### Free Tier Nudges (Upgrade Prompts)

Timing upgrade prompts at the moment of maximum pain:

1. **Hit 100 captures:** "You've captured 100 webhooks today — nice! Upgrade to Pro for unlimited captures." (Show at the top of the request list, not as a blocking popup.)

2. **Try to replay:** "Replay lets you resend this webhook to localhost:3000. Available on Pro ($14/mo)." (Show a disabled replay button with tooltip.)

3. **24-hour expiry warning:** "Your captures expire in 2 hours. Upgrade to Pro for 30-day retention." (Toast notification, 2 hours before expiry.)

4. **Invite a teammate:** "Want to share this with a colleague? Team plan includes 5 seats." (Show when user copies a share link.)

5. **Try OpenAPI import:** "Import your OpenAPI spec to auto-generate mock endpoints. Available on Team ($49/mo)." (Show when user manually creates 5+ mock endpoints.)

---

## 7. Key Metrics & Unit Economics

### Customer Acquisition Cost (CAC)

| Channel | Cost | Expected Conversions/mo | CAC |
|---------|------|------------------------|-----|
| Organic search (SEO) | $0 (time only) | 20 signups | $0 |
| Hacker News / Show HN | $0 | 50-200 signups (burst) | $0 |
| Dev.to / Hashnode articles | $0 (time only) | 10 signups | $0 |
| Twitter/X dev community | $0 | 5-10 signups | $0 |
| Product Hunt launch | $0 | 100-500 signups (burst) | $0 |
| GitHub stars / README links | $0 | 15 signups | $0 |
| **Total (bootstrapped)** | **$0** | **100-300/mo steady** | **$0** |

This is the beauty of developer tools — if the product is good, distribution is nearly free. Budget is time, not money.

### Customer Lifetime Value (LTV)

| Plan | Monthly Price | Avg Lifetime | LTV | LTV:CAC |
|------|-------------|-------------|-----|---------|
| Pro | $14 | 8 months | $112 | ∞ (CAC≈$0) |
| Team | $49 | 14 months | $686 | ∞ |
| Business | $149 | 20 months | $2,980 | ∞ |

With zero CAC (bootstrapped, organic), even modest LTVs are profitable from day one.

### Gross Margin

| Cost Category | Monthly Cost (at $5K MRR) | % of Revenue |
|-------------|--------------------------|-------------|
| Hosting (Railway) | $50-$100 | 1-2% |
| Database (managed Postgres) | $30-$50 | 0.6-1% |
| Redis | $15-$25 | 0.3-0.5% |
| Transactional email | $10-$20 | 0.2-0.4% |
| Domain + CDN | $5 | 0.1% |
| Sentry (error tracking) | $0 (free tier) | 0% |
| Payment processing (Stripe) | $145 (2.9%) | 2.9% |
| **Total COGS** | **~$260-$350** | **~5-7%** |
| **Gross Margin** | | **93-95%** |

Software margins are excellent. Infrastructure costs scale sub-linearly with users because webhook/mock payloads are small.

---

## 8. Competitive Moat Strategy

The mock API feature creates a much stronger moat than webhook testing alone:

### Moat 1: Workflow Lock-In
```
Team onboards → Defines mock APIs → Frontend builds against mocks →
Mocks become the API contract → Switching cost increases with every endpoint defined
```
Unlike webhook testing (swap a URL, done), mock APIs accumulate team knowledge. The mock configurations, response templates, and test sequences become organizational IP that's painful to recreate elsewhere.

### Moat 2: Network Effects (Within a Team)
```
1 developer uses HookTrap → invites backend dev → invites frontend dev →
invites QA → invites PM (to view API contracts) → whole team is on HookTrap
```
Each new team member makes the tool more valuable for everyone else. Postman had this with collections. HookTrap can have it with mock workspaces.

### Moat 3: Integration Depth
```
OpenAPI spec linked → Mock endpoints auto-generated → Contract validation active →
CI/CD pipeline uses mocks for integration tests → HookTrap is infrastructure
```
The deeper HookTrap embeds into the development workflow, the harder it is to rip out.

### Moat 4: Template Ecosystem
```
Community creates Stripe mock template → 500 teams use it →
Template author improves it → Community contributes variations →
HookTrap becomes the "npm of API mocks"
```
User-generated content creates a flywheel that competitors can't easily replicate.

---

## 9. Competitive Positioning Map

```
                    HIGH PRICE
                        │
           Svix         │         Hookdeck
        ($490/mo)       │         (enterprise)
                        │
                        │
    ──────── WEBHOOKS ONLY ────────────── WEBHOOKS + MOCKS ──────
                        │
                        │              ★ HOOKTRAP
        Webhook.site    │              ($14-$149/mo)
        (basic/free)    │
                        │    Mockoon Pro ($15/mo)
        ngrok           │    Beeceptor
        (tunneling)     │
                        │
                   LOW PRICE

    HookTrap occupies unique position: affordable + both webhooks AND mocks
```

Nobody else combines webhook capture + mock APIs in a single tool. Postman technically has both, but it's bloated, expensive, and overly complex. Mockoon is mocks-only. Webhook.site is capture-only. **HookTrap owns the intersection.**

---

## 10. Revenue Projections (3 Scenarios)

### Conservative (Slow organic growth)

| Month | Free Users | Pro | Team | Biz | MRR | ARR |
|-------|-----------|-----|------|-----|-----|-----|
| 6 | 1,500 | 25 | 3 | 0 | $497 | $6.0K |
| 12 | 5,000 | 100 | 15 | 2 | $2,433 | $29.2K |
| 18 | 12,000 | 200 | 40 | 5 | $5,515 | $66.2K |
| 24 | 25,000 | 400 | 80 | 12 | $11,288 | $135.5K |

### Base Case (Moderate growth, 1 viral moment)

| Month | Free Users | Pro | Team | Biz | MRR | ARR |
|-------|-----------|-----|------|-----|-----|-----|
| 6 | 3,000 | 50 | 8 | 0 | $1,092 | $13.1K |
| 12 | 12,000 | 200 | 40 | 5 | $5,515 | $66.2K |
| 18 | 30,000 | 500 | 120 | 15 | $15,135 | $181.6K |
| 24 | 60,000 | 900 | 250 | 35 | $30,235 | $362.8K |

### Optimistic (HN front page + strong word of mouth)

| Month | Free Users | Pro | Team | Biz | MRR | ARR |
|-------|-----------|-----|------|-----|-----|-----|
| 6 | 8,000 | 100 | 15 | 2 | $2,433 | $29.2K |
| 12 | 30,000 | 500 | 100 | 15 | $12,135 | $145.6K |
| 18 | 80,000 | 1,200 | 300 | 40 | $33,500 | $402.0K |
| 24 | 150,000 | 2,500 | 600 | 80 | $66,300 | $795.6K |

### Key Assumptions for All Scenarios
- Free→Pro conversion: 1.5-3% (varies by scenario)
- Average Team plan has 3.5 seats (1.5 extra seats at $8 = $12 extra)
- Average Business plan has 12 seats (adds ~$0 since 20 included)
- Monthly churn: Pro 5%, Team 3%, Business 2%
- No paid acquisition spend in any scenario

---

## 11. Break-Even & Full-Time Decision

### Monthly Costs (Fixed)

| Item | Cost |
|------|------|
| Infrastructure | $100-$200 |
| Domain/DNS | $2 |
| Email service | $10 |
| Total fixed | ~$200/mo |

### Break-Even: ~$200 MRR (15 Pro users)

This is achievable within 3-4 months of launching the paid tier.

### "Quit My Job" Number

Depends on your personal situation, but common thresholds:
- **$3,000 MRR** — Covers basic living expenses (if low cost of living area)
- **$5,000 MRR** — Comfortable for most solo founders
- **$8,000 MRR** — Buffer for growth investment, contractor help, etc.

Based on the **base case**, $5K MRR is achievable around **month 15-18** from launch.

---

## 12. Updated Requirements for Claude Code

Add these to the `HOOKTRAP_REQUIREMENTS.md` spec:

### New Database Tables

```sql
-- ============================================================
-- MOCK ENDPOINTS
-- ============================================================
CREATE TABLE mock_endpoints (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL,  -- shared across team
    user_id         UUID REFERENCES users(id),
    path            VARCHAR(500) NOT NULL,  -- e.g., /api/users/:id
    method          VARCHAR(10) NOT NULL,
    name            VARCHAR(200),
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    priority        INTEGER DEFAULT 0,  -- higher = checked first
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Default response (used when no rules match)
    response_status INTEGER DEFAULT 200,
    response_headers JSONB DEFAULT '{"Content-Type": "application/json"}',
    response_body   TEXT,
    response_delay_ms INTEGER DEFAULT 0,

    UNIQUE(workspace_id, path, method)
);

CREATE INDEX idx_mock_endpoints_workspace ON mock_endpoints(workspace_id, is_active);

-- ============================================================
-- MOCK RESPONSE RULES
-- ============================================================
CREATE TABLE mock_response_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mock_endpoint_id UUID NOT NULL REFERENCES mock_endpoints(id) ON DELETE CASCADE,
    name            VARCHAR(200),
    priority        INTEGER DEFAULT 0,  -- higher = checked first

    -- Matching conditions (all must match = AND logic)
    match_conditions JSONB NOT NULL,
    -- Example: {
    --   "body.role": "admin",
    --   "query.page": "1",
    --   "headers.authorization": "Bearer *"
    -- }

    -- Response to return when matched
    response_status INTEGER NOT NULL DEFAULT 200,
    response_headers JSONB DEFAULT '{}',
    response_body   TEXT,
    response_delay_ms INTEGER DEFAULT 0,

    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mock_rules_endpoint ON mock_response_rules(mock_endpoint_id, priority DESC);

-- ============================================================
-- MOCK REQUEST LOG
-- ============================================================
CREATE TABLE mock_request_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mock_endpoint_id UUID NOT NULL REFERENCES mock_endpoints(id) ON DELETE CASCADE,
    method          VARCHAR(10) NOT NULL,
    path            TEXT NOT NULL,
    query_params    JSONB DEFAULT '{}',
    headers         JSONB NOT NULL DEFAULT '{}',
    body            TEXT,
    source_ip       INET,
    matched_rule_id UUID REFERENCES mock_response_rules(id),  -- NULL if default used
    response_status INTEGER,
    response_delay_ms INTEGER,
    received_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mock_logs_endpoint ON mock_request_logs(mock_endpoint_id, received_at DESC);

-- ============================================================
-- WORKSPACES (Team feature)
-- ============================================================
CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    short_id        VARCHAR(12) UNIQUE NOT NULL,
    name            VARCHAR(200) NOT NULL,
    owner_id        UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workspace_members (
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);
```

### New API Endpoints

```
POST   /api/v1/workspaces                          Create workspace
GET    /api/v1/workspaces                           List my workspaces
POST   /api/v1/workspaces/{id}/members              Invite member
DELETE /api/v1/workspaces/{id}/members/{user_id}    Remove member

POST   /api/v1/workspaces/{id}/mocks                Create mock endpoint
GET    /api/v1/workspaces/{id}/mocks                List mock endpoints
GET    /api/v1/workspaces/{id}/mocks/{mock_id}      Get mock endpoint detail
PATCH  /api/v1/workspaces/{id}/mocks/{mock_id}      Update mock endpoint
DELETE /api/v1/workspaces/{id}/mocks/{mock_id}      Delete mock endpoint

POST   /api/v1/mocks/{mock_id}/rules                Add response rule
PATCH  /api/v1/mocks/{mock_id}/rules/{rule_id}      Update rule
DELETE /api/v1/mocks/{mock_id}/rules/{rule_id}      Delete rule

GET    /api/v1/mocks/{mock_id}/logs                 View mock request logs

POST   /api/v1/workspaces/{id}/import-openapi       Import OpenAPI spec

# Mock serving route (the actual mock API)
ALL    /m/{workspace_short_id}/*                    Serve mock response
```

### New Frontend Pages

```
/dashboard/workspace/[id]               Workspace overview
/dashboard/workspace/[id]/mocks         Mock endpoint list
/dashboard/workspace/[id]/mocks/[mid]   Mock endpoint editor (rules, responses, logs)
/dashboard/workspace/[id]/members       Team management
/dashboard/workspace/[id]/import        OpenAPI import wizard
```

---

## 13. Implementation Priority (Updated)

Given the mock API addition, here's the revised build order:

```
Phase 1 (Week 1-2):  Webhook capture engine + basic frontend     ← Same as before
Phase 2 (Week 3):    Auth + replay + sharing                     ← Same as before
Phase 3 (Week 4-5):  Mock API engine (basic: static responses)   ← NEW
Phase 4 (Week 6):    Dynamic templates + request matching         ← NEW
Phase 5 (Week 7-8):  Workspaces + team features                  ← NEW
Phase 6 (Week 9-10): OpenAPI import + contract validation         ← NEW
Phase 7 (Week 11-12): Payment integration + launch paid tiers    ← Moved later
```

The mock API feature adds ~4 weeks to the build but transforms the revenue potential from $10K to $100K+ ARR.

---

**End of revenue model. This document + the technical requirements spec gives Claude Code everything needed to build the complete product.**
