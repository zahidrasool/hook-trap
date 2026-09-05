import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export const metadata: Metadata = {
  // Absolute, so the root layout's "%s | MockLane" template does not append
  // the brand twice on the page where it already leads.
  title: {
    absolute: "MockLane — Webhook Testing, Mock APIs & Email Sandboxes",
  },
  description:
    "Capture and replay webhooks, stand up mock APIs with dynamic responses, and catch test email in a sandbox inbox. Free plan, no credit card.",
  alternates: { canonical: "/" },
};

// The three pillars of the product. Everything else on this page is detail.
const pillars = [
  {
    name: "Webhook Capture",
    tagline: "See exactly what they sent you",
    body: "Point Stripe, GitHub, or any provider at a URL you own and inspect the payload the instant it lands — then replay it whenever you need it again.",
    bullets: ["Any method, any payload", "Headers, body, source IP", "One-click replay"],
    accent: "indigo",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" />
      </svg>
    ),
  },
  {
    name: "Mock APIs",
    tagline: "Build against an API that does not exist yet",
    body: "Define endpoints with generated data, conditional rules, and multi-step sequences, so your frontend is never blocked waiting on a backend team.",
    bullets: ["121 data generators", "Conditional rules & sequences", "OpenAPI import"],
    accent: "violet",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
      </svg>
    ),
  },
  {
    name: "Fake SMTP Inbox",
    tagline: "Test email without emailing customers",
    body: "Point your app's SMTP config at MockLane and every message lands in a sandbox inbox instead of a real mailbox. Nothing escapes to a real recipient.",
    bullets: ["Real inbox address", "HTML preview & headers", "Download attachments"],
    accent: "emerald",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
  },
];

const ACCENT: Record<string, { tile: string; text: string; ring: string }> = {
  indigo: {
    tile: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    text: "text-indigo-600 dark:text-indigo-400",
    ring: "hover:border-indigo-300 dark:hover:border-indigo-500/40",
  },
  violet: {
    tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    text: "text-violet-600 dark:text-violet-400",
    ring: "hover:border-violet-300 dark:hover:border-violet-500/40",
  },
  emerald: {
    tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "hover:border-emerald-300 dark:hover:border-emerald-500/40",
  },
};

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

        <h1 className="mx-auto max-w-4xl text-[2.5rem] font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-[4rem]">
          Webhooks, mock APIs,
          <br className="hidden sm:block" /> and email —{" "}
          <span className="text-indigo-600 dark:text-indigo-400">
            in one place
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400 sm:text-xl">
          Capture what providers actually send you, stand up the API that does
          not exist yet, and catch every outbound email before it reaches a real
          customer.
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

      {/* ── The three pillars ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
          One platform, three tools
        </p>
        <h2 className="mx-auto mb-4 max-w-3xl text-center text-3xl font-extrabold tracking-tight sm:text-[2.5rem]">
          Everything you currently
          <br className="hidden sm:block" /> stitch together by hand
        </h2>
        <p className="mx-auto mb-14 max-w-2xl text-center text-lg text-slate-600 dark:text-slate-400">
          A webhook inspector, a mocking tool, and a throwaway mailbox — in one
          dashboard, sharing one workspace.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {pillars.map((p) => {
            const a = ACCENT[p.accent];
            return (
              <div
                key={p.name}
                className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-none ${a.ring}`}
              >
                <div className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl ${a.tile}`}>
                  {p.icon}
                </div>

                <h3 className="mb-1.5 text-xl font-bold">{p.name}</h3>
                <p className={`mb-4 text-sm font-semibold ${a.text}`}>{p.tagline}</p>
                <p className="mb-6 flex-1 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {p.body}
                </p>

                <ul className="space-y-2.5 border-t border-slate-100 pt-5 dark:border-white/[0.06]">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <svg className={`mt-0.5 h-4 w-4 flex-shrink-0 ${a.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
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
