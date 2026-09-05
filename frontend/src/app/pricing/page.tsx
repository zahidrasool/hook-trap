import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { JsonLd, ORG_ID, SITE_URL, SOFTWARE_ID } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "MockLane pricing: a free plan for side projects, Pro at $12/month and Team at $39/month. Webhook capture, mock APIs and sandbox inboxes on every plan.",
  alternates: { canonical: "/pricing" },
};

// Quotas and limits here mirror backend/app/services/billing_service.py PLANS
// exactly. They are enforced — exceeding a quota returns HTTP 429 — so any
// number changed there has to change here too, or the page promises something
// the API will refuse.
const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for solo developers and side projects.",
    features: [
      "2 workspaces",
      "10 mock endpoints per workspace",
      "1 email sandbox",
      "10,000 mock API requests / month",
      "1,000 webhook captures / month",
      "200 inbound emails / month",
      "Community support",
    ],
    cta: "Get Started",
    href: "/auth/login",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/ month",
    description: "For professional developers and growing teams.",
    features: [
      "10 workspaces",
      "100 mock endpoints per workspace",
      "10 email sandboxes",
      "250,000 mock API requests / month",
      "50,000 webhook captures / month",
      "5,000 inbound emails / month",
      "Response sequences & rules",
      "OpenAPI import",
      "Priority support",
    ],
    cta: "Get Started",
    href: "/auth/login",
    highlight: true,
  },
  {
    name: "Team",
    price: "$39",
    period: "/ month",
    description: "For teams that need collaboration and scale.",
    features: [
      "50 workspaces",
      "500 mock endpoints per workspace",
      "50 email sandboxes",
      "1,000,000 mock API requests / month",
      "250,000 webhook captures / month",
      "25,000 inbound emails / month",
      "Team member roles & permissions",
      "Contract validation",
      "Dedicated support",
    ],
    cta: "Get Started",
    href: "/auth/login",
    highlight: false,
  },
];

// Offers are derived from the same `plans` array the page renders, so the
// structured data cannot drift from the prices a visitor actually sees.
//
// The currency is the one assumption here: the page shows "$" and there is no
// ISO code in the page or in billing_service.py's PLANS (which stores Stripe
// price ids, not amounts). USD is the conventional reading; if the Stripe
// Price objects are ever created in another currency, this must change with
// them or the markup will misstate what a customer is charged.
const PRICE_CURRENCY = "USD";

const offers = plans.map((plan) => {
  const amount = plan.price.replace(/[^0-9.]/g, "");
  const isRecurring = plan.period.includes("month");
  return {
    "@type": "Offer",
    name: plan.name,
    price: amount,
    priceCurrency: PRICE_CURRENCY,
    url: `${SITE_URL}/pricing`,
    availability: "https://schema.org/InStock",
    ...(isRecurring
      ? {
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: amount,
            priceCurrency: PRICE_CURRENCY,
            billingDuration: 1,
            billingIncrement: 1,
            unitCode: "MON",
          },
        }
      : {}),
  };
});

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "@id": SOFTWARE_ID,
          name: "MockLane",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          url: `${SITE_URL}/pricing`,
          description:
            "Webhook capture, mock APIs and sandbox email inboxes. Free plan, plus paid tiers with higher quotas.",
          publisher: { "@id": ORG_ID },
          offers,
        }}
      />

      <PublicHeader />

      {/* Header */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-16 text-center lg:px-8">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl text-slate-900 dark:text-white">
          Simple, transparent{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">pricing</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-slate-600 dark:text-slate-400">
          Start free, upgrade when you need more. No hidden fees, no surprises.
        </p>
      </section>

      {/* Plans */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-32 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 sm:p-10 transition-all ${
                plan.highlight
                  ? "border-indigo-500/50 bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-500/10 dark:to-transparent shadow-lg shadow-indigo-500/10"
                  : "border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-sm dark:shadow-none"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-1 text-sm font-semibold text-white">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">{plan.price}</span>
                <span className="text-lg text-slate-600 dark:text-slate-400">{plan.period}</span>
              </div>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400">{plan.description}</p>

              <Link
                href={plan.href}
                className={`mt-8 block w-full rounded-xl py-3 text-center text-base font-semibold transition-all ${
                  plan.highlight
                    ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110"
                    : "border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-300">
                    <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
