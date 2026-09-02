import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

const steps = [
  {
    label: "Capture",
    title: "Point any webhook at a URL you own",
    body: "Generate an endpoint and send Stripe, GitHub, or Slack events straight to it. Headers, body, and timing are inspectable the moment they land.",
  },
  {
    label: "Mock",
    title: "Stand up the API before it exists",
    body: "Define endpoints with dynamic data, conditional rules, and response sequences, so the frontend team is never blocked waiting on a backend.",
  },
  {
    label: "Replay",
    title: "Reproduce the exact failing request",
    body: "Replay any captured request on demand, tweaking headers or body first. Stop asking a third party to resend the event that broke things.",
  },
];

const features = [
  {
    emoji: "🪝",
    title: "Webhook capture",
    body: "Unique URLs that accept any method and payload. Inspect headers, body, query params, and source IP in real time.",
  },
  {
    emoji: "🧩",
    title: "Mock API builder",
    body: "Status codes, headers, delays, and error simulation per endpoint. Match on path params or fall through to conditional rules.",
  },
  {
    emoji: "🎲",
    title: "121 data generators",
    body: "Template responses with {{faker.email}}, {{faker.uuid}} and 119 more. Loop with repeat(), branch with oneOf().",
  },
  {
    emoji: "🔁",
    title: "Request replay",
    body: "Re-send any captured webhook with one click. Edit the payload first to reproduce edge cases on demand.",
  },
  {
    emoji: "📥",
    title: "Email sandboxes",
    body: "A real inbox address for testing signup and notification mail. Preview HTML, read headers, download attachments — customers never get hit.",
  },
  {
    emoji: "📄",
    title: "OpenAPI import",
    body: "Drop in a Swagger or OpenAPI spec and get working mock endpoints, then validate responses back against the schema.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <PublicHeader />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 text-center lg:px-8 lg:pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(99,102,241,0.10),transparent)] dark:bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(99,102,241,0.16),transparent)]" />

        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Webhook testing, mock APIs, and email sandboxes in one place
        </div>

        <h1 className="mx-auto max-w-4xl text-[2.75rem] font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.25rem]">
          Stop waiting on
          <br />
          <span className="text-indigo-600 dark:text-indigo-400">
            someone else&apos;s API
          </span>{" "}
          to test yours
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400 sm:text-xl">
          Capture real webhooks, mock the endpoints that do not exist yet, and
          replay the request that broke — without leaving your terminal.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/30"
          >
            Start free
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Read the docs
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          No credit card required · Free plan · Set up in under a minute
        </p>

        {/* Product visual */}
        <div className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-left shadow-2xl shadow-slate-900/10 dark:border-white/10">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-3 font-mono text-xs text-slate-400">
              POST /h/abc123 — captured 0.2s ago
            </span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-slate-300">
            <code>{`{
  "id": "evt_1P9x2K",
  "type": "checkout.session.completed",
  "data": {
    "customer_email": "ada@example.com",
    "amount_total": 4900,
    "currency": "usd"
  }
}`}</code>
          </pre>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
          How it works
        </p>
        <h2 className="mx-auto mb-14 max-w-3xl text-center text-3xl font-extrabold tracking-tight sm:text-[2.5rem]">
          Three tools your team currently
          <br className="hidden sm:block" /> stitches together by hand
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-white/[0.08] dark:bg-white/[0.03]"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-base font-bold text-white">
                {i + 1}
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {s.label}
              </p>
              <h3 className="mb-3 text-lg font-bold">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Benefits ───────────────────────────────────────────────────── */}
      <section id="features" className="border-y border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
            Benefits
          </p>
          <h2 className="mx-auto mb-4 max-w-3xl text-center text-3xl font-extrabold tracking-tight sm:text-[2.5rem]">
            Why developers pick MockLane
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-lg text-slate-600 dark:text-slate-400">
            One dashboard instead of a webhook inspector, a mocking tool, and a
            throwaway mailbox.
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-none dark:hover:border-indigo-500/30"
              >
                <div className="mb-4 text-2xl">{f.emoji}</div>
                <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deep dive ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
              Mock APIs
            </p>
            <h2 className="mb-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
              Responses that behave like a real backend
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Static fixtures fall over the moment you need pagination, a 500, or
              a second call that returns something different. MockLane endpoints
              carry state, rules, and generated data — so the client you are
              building can be exercised properly.
            </p>

            <ul className="space-y-3.5">
              {[
                "Conditional rules that match on header, query, or body",
                "Response sequences for retry and polling flows",
                "Error and latency simulation per endpoint",
                "Contract validation against your OpenAPI schema",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span className="text-[15px] text-slate-700 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-8">
              {[
                { n: "121", l: "data generators" },
                { n: "3", l: "tools in one" },
                { n: "<1 min", l: "to first capture" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{s.n}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-xl dark:border-white/10">
            <div className="border-b border-white/10 px-4 py-3 font-mono text-xs text-slate-400">
              GET /m/team-xyz/api/users
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-slate-300">
              <code>{`{
  "users": [
    {{repeat(3)}}
    {
      "id": "{{faker.uuid}}",
      "name": "{{faker.name}}",
      "email": "{{faker.email}}",
      "plan": {{oneOf("free","pro")}}
    }
    {{/repeat}}
  ]
}`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24 lg:px-8">
        <div className="rounded-3xl bg-indigo-600 px-8 py-16 text-center sm:px-16">
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-[2.5rem]">
            Capture your first webhook in under a minute
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-indigo-100">
            Free plan, no credit card, and nothing to install.
          </p>
          <Link
            href="/auth/login"
            className="mt-9 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-indigo-700 shadow-lg transition-all hover:bg-indigo-50"
          >
            Start free
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
