import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export const metadata: Metadata = {
  title: "Contact — MockLane",
  description:
    "Get in touch with the MockLane team about support, billing, refunds, or security reports.",
};

const SUPPORT_EMAIL = "info@mocklane.com";

// Kept deliberately factual. The FAQ already promises a 14-day refund window,
// so that promise is restated here rather than reworded — a refund page and an
// FAQ that disagree on the terms is worse than having neither.
const reasons = [
  {
    title: "Support",
    body: "Something not behaving the way the docs describe? Include the workspace name and, if it is about a specific request, the endpoint URL and roughly when it happened — that is usually enough to find it in the logs.",
  },
  {
    title: "Billing and refunds",
    body: "If you are not satisfied, contact us within 14 days of your purchase for a full refund, no questions asked. Include the email address on the account.",
  },
  {
    title: "Security",
    body: "If you have found a vulnerability, please report it privately by email before disclosing it anywhere else. Tell us what you found and how to reproduce it, and we will confirm receipt.",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
      </div>

      <PublicHeader />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-16 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Contact us
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            One inbox, read by the people who build MockLane. There is no ticket
            portal and no phone queue.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-10 inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110"
          >
            {SUPPORT_EMAIL}
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </a>
        </div>
      </section>

      {/* What to include */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-3xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-8 shadow-sm dark:shadow-none"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {reason.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
                {reason.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
