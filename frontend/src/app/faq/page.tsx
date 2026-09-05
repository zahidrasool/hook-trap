"use client";

import { useState } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

const faqs = [
  {
    category: "General",
    questions: [
      {
        q: "What is MockLane?",
        a: "MockLane is a developer platform for webhook testing and mock API creation. It lets you capture incoming webhooks, build mock API endpoints with dynamic responses, replay captured requests, and receive test emails via sandbox inboxes.",
      },
      {
        q: "Do I need a credit card to get started?",
        a: "No. The free plan is completely free with no credit card required. You can start capturing webhooks and creating mock APIs in seconds.",
      },
      {
        q: "How is MockLane different from other webhook testing tools?",
        a: "MockLane combines webhook capture, mock API creation, request replay, and email sandboxes in a single platform. Most tools only handle one of these. Plus, our template engine supports 100+ dynamic data generators powered by Faker.",
      },
    ],
  },
  {
    category: "Webhook Capture",
    questions: [
      {
        q: "How do I capture webhooks?",
        a: "Create an endpoint in your dashboard, and you'll get a unique URL. Point your webhook provider (Stripe, GitHub, Shopify, etc.) to that URL, and MockLane captures every request with full headers, body, and metadata.",
      },
      {
        q: "Can I replay captured webhooks?",
        a: "Yes. Click any captured request and hit 'Replay' to resend it to any URL. You can modify headers and body before replaying, making it easy to debug and test edge cases.",
      },
      {
        q: "How long are captured requests stored?",
        a: "Free plan: 7 days. Pro plan: 30 days. Team plan: 90 days. You can export captures at any time.",
      },
    ],
  },
  {
    category: "Mock APIs",
    questions: [
      {
        q: "What are mock endpoints?",
        a: "Mock endpoints let you create fake API responses without writing backend code. Define a path, method, status code, and response body — MockLane serves it instantly. Great for unblocking frontend development.",
      },
      {
        q: "Can I use dynamic data in mock responses?",
        a: "Yes. Use template variables like {{faker.name()}}, {{faker.email()}}, {{randomInt(1,100)}}, or {{request.body.userId}} to generate realistic, dynamic responses. We support 100+ Faker-based generators.",
      },
      {
        q: "What are response sequences?",
        a: "Response sequences let a mock endpoint return different responses on successive calls. For example: first call returns 200, second returns 429, third returns 500. Perfect for testing error handling and retry logic.",
      },
      {
        q: "Can I import my OpenAPI spec?",
        a: "Yes. Upload your OpenAPI/Swagger spec and MockLane auto-generates mock endpoints for every path. Go from spec to working mock API in seconds.",
      },
    ],
  },
  {
    category: "Email Sandboxes",
    questions: [
      {
        q: "What are email sandboxes?",
        a: "Email sandboxes give you a dedicated email address (e.g., myapp@inbox.mocklane.com) that captures all incoming emails. Use it to test email-sending features like signup confirmations, notifications, and transactional emails.",
      },
      {
        q: "Can I send emails to the sandbox via SMTP?",
        a: "Yes. Each sandbox comes with SMTP credentials. Configure your app to use our SMTP server, and all emails land in your sandbox inbox — no real emails are sent.",
      },
    ],
  },
  {
    category: "Billing & Plans",
    questions: [
      {
        q: "Can I upgrade or downgrade at any time?",
        a: "Yes. Upgrade instantly from your dashboard settings. When you downgrade, you keep your current plan until the end of your billing period.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards (Visa, Mastercard, American Express) through Stripe. Payments are processed securely — we never see your card details.",
      },
      {
        q: "Is there a refund policy?",
        a: "Yes. If you're not satisfied, email info@mocklane.com within 14 days of your purchase for a full refund. No questions asked. See the contact page for what to include.",
      },
    ],
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-200 dark:border-white/[0.06] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-5 text-left text-slate-900 dark:text-white transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <span className="text-base font-medium pr-4">{q}</span>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <p className="pb-5 text-base leading-relaxed text-slate-600 dark:text-slate-400">{a}</p>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
      </div>

      <PublicHeader />

      {/* Header */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-16 text-center lg:px-8">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl text-slate-900 dark:text-white">
          Frequently asked{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">questions</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-slate-600 dark:text-slate-400">
          Everything you need to know about MockLane. Can&apos;t find what you&apos;re looking for? Reach out at info@mocklane.com.
        </p>
      </section>

      {/* FAQ sections */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-32 lg:px-8">
        {faqs.map((section) => (
          <div key={section.category} className="mb-12">
            <h2 className="mb-4 text-lg font-semibold text-indigo-600 dark:text-indigo-400">{section.category}</h2>
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-sm dark:shadow-none px-6">
              {section.questions.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-32 lg:px-8">
        <div className="rounded-3xl border border-slate-200 dark:border-white/[0.08] bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-500/10 dark:via-slate-900 dark:to-violet-500/10 shadow-sm dark:shadow-none p-16 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Still have questions?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
            We&apos;re here to help. Send us an email and we&apos;ll get back to you within 24 hours.
          </p>
          <a
            href="mailto:info@mocklane.com"
            className="mt-8 inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110"
          >
            Contact Us
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </a>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
