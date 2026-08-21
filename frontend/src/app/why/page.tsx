"use client";

import { Fragment } from "react";
import Link from "next/link";

/* ──────────────────────────────────────────────────────────────
   Data
   ────────────────────────────────────────────────────────────── */

const competitors = [
  {
    name: "HookTrap",
    highlight: true,
    webhookCapture: true,
    fakeInbox: true,
    spamAnalysis: true,
    htmlCssValidation: true,
    emailForwarding: true,
    multipleInboxes: true,
    emailClientPreview: false,
    mockApis: true,
    dynamicData: true,
    templateEngine: true,
    conditionalRules: true,
    responseSequences: true,
    openApiImport: true,
    requestReplay: true,
    teamWorkspaces: true,
    roleBasedAccess: true,
    restApi: true,
    contractValidation: true,
    requestLogs: true,
    corsSupport: true,
    selfHostable: true,
    freeTier: "Generous",
    pricing: "Free / Open Source",
  },
  {
    name: "Mailtrap",
    highlight: false,
    webhookCapture: false,
    fakeInbox: true,
    spamAnalysis: true,
    htmlCssValidation: true,
    emailForwarding: true,
    multipleInboxes: true,
    emailClientPreview: true,
    mockApis: false,
    dynamicData: false,
    templateEngine: false,
    conditionalRules: false,
    responseSequences: false,
    openApiImport: false,
    requestReplay: false,
    teamWorkspaces: true,
    roleBasedAccess: true,
    restApi: true,
    contractValidation: false,
    requestLogs: false,
    corsSupport: false,
    selfHostable: false,
    freeTier: "100 emails/mo",
    pricing: "Free / $14.99+/mo",
  },
  {
    name: "Webhook.site",
    highlight: false,
    webhookCapture: true,
    fakeInbox: false,
    spamAnalysis: false,
    htmlCssValidation: false,
    emailForwarding: false,
    multipleInboxes: false,
    emailClientPreview: false,
    mockApis: false,
    dynamicData: false,
    templateEngine: false,
    conditionalRules: false,
    responseSequences: false,
    openApiImport: false,
    requestReplay: false,
    teamWorkspaces: false,
    roleBasedAccess: false,
    restApi: false,
    contractValidation: false,
    requestLogs: true,
    corsSupport: false,
    selfHostable: false,
    freeTier: "Limited",
    pricing: "Free / $19+/mo",
  },
  {
    name: "Beeceptor",
    highlight: false,
    webhookCapture: true,
    fakeInbox: false,
    spamAnalysis: false,
    htmlCssValidation: false,
    emailForwarding: false,
    multipleInboxes: false,
    emailClientPreview: false,
    mockApis: true,
    dynamicData: false,
    templateEngine: false,
    conditionalRules: true,
    responseSequences: false,
    openApiImport: false,
    requestReplay: false,
    teamWorkspaces: false,
    roleBasedAccess: false,
    restApi: false,
    contractValidation: false,
    requestLogs: true,
    corsSupport: true,
    selfHostable: false,
    freeTier: "50 req/day",
    pricing: "Free / $9.99+/mo",
  },
  {
    name: "MockAPI.io",
    highlight: false,
    webhookCapture: false,
    fakeInbox: false,
    spamAnalysis: false,
    htmlCssValidation: false,
    emailForwarding: false,
    multipleInboxes: false,
    emailClientPreview: false,
    mockApis: true,
    dynamicData: true,
    templateEngine: false,
    conditionalRules: false,
    responseSequences: false,
    openApiImport: false,
    requestReplay: false,
    teamWorkspaces: true,
    roleBasedAccess: false,
    restApi: true,
    contractValidation: false,
    requestLogs: false,
    corsSupport: true,
    selfHostable: false,
    freeTier: "1 project",
    pricing: "Free / $5/mo",
  },
  {
    name: "Mockoon",
    highlight: false,
    webhookCapture: false,
    fakeInbox: false,
    spamAnalysis: false,
    htmlCssValidation: false,
    emailForwarding: false,
    multipleInboxes: false,
    emailClientPreview: false,
    mockApis: true,
    dynamicData: true,
    templateEngine: true,
    conditionalRules: true,
    responseSequences: true,
    openApiImport: true,
    requestReplay: false,
    teamWorkspaces: false,
    roleBasedAccess: false,
    restApi: false,
    contractValidation: false,
    requestLogs: true,
    corsSupport: true,
    selfHostable: true,
    freeTier: "Full (Desktop)",
    pricing: "Free / Cloud $7+/mo",
  },
  {
    name: "WireMock",
    highlight: false,
    webhookCapture: false,
    fakeInbox: false,
    spamAnalysis: false,
    htmlCssValidation: false,
    emailForwarding: false,
    multipleInboxes: false,
    emailClientPreview: false,
    mockApis: true,
    dynamicData: true,
    templateEngine: true,
    conditionalRules: true,
    responseSequences: true,
    openApiImport: true,
    requestReplay: false,
    teamWorkspaces: true,
    roleBasedAccess: true,
    restApi: true,
    contractValidation: true,
    requestLogs: true,
    corsSupport: true,
    selfHostable: true,
    freeTier: "Open Source",
    pricing: "Free / Cloud $$$",
  },
  {
    name: "RequestBin",
    highlight: false,
    webhookCapture: true,
    fakeInbox: false,
    spamAnalysis: false,
    htmlCssValidation: false,
    emailForwarding: false,
    multipleInboxes: false,
    emailClientPreview: false,
    mockApis: false,
    dynamicData: false,
    templateEngine: false,
    conditionalRules: false,
    responseSequences: false,
    openApiImport: false,
    requestReplay: false,
    teamWorkspaces: false,
    roleBasedAccess: false,
    restApi: false,
    contractValidation: false,
    requestLogs: true,
    corsSupport: false,
    selfHostable: false,
    freeTier: "Limited",
    pricing: "Part of Pipedream",
  },
];

const featureRows: { key: keyof (typeof competitors)[0]; label: string; group?: string }[] = [
  { key: "webhookCapture", label: "Webhook Capture", group: "Core" },
  { key: "fakeInbox", label: "Fake SMTP Inbox", group: "Email Sandbox" },
  { key: "spamAnalysis", label: "Spam Score Analysis", group: "Email Sandbox" },
  { key: "htmlCssValidation", label: "HTML/CSS Email Validation", group: "Email Sandbox" },
  { key: "emailForwarding", label: "Email Forwarding", group: "Email Sandbox" },
  { key: "multipleInboxes", label: "Multiple Inboxes", group: "Email Sandbox" },
  { key: "emailClientPreview", label: "Email Client Preview", group: "Email Sandbox" },
  { key: "mockApis", label: "Mock API Builder", group: "API Mocking" },
  { key: "dynamicData", label: "Dynamic Data (Faker)", group: "API Mocking" },
  { key: "templateEngine", label: "Template Engine", group: "API Mocking" },
  { key: "conditionalRules", label: "Conditional Rules", group: "API Mocking" },
  { key: "responseSequences", label: "Response Sequences", group: "API Mocking" },
  { key: "openApiImport", label: "OpenAPI / Swagger Import", group: "API Mocking" },
  { key: "requestReplay", label: "Request Replay", group: "Testing" },
  { key: "contractValidation", label: "Contract Validation", group: "Testing" },
  { key: "requestLogs", label: "Request Logs", group: "Testing" },
  { key: "teamWorkspaces", label: "Team Workspaces", group: "Collaboration" },
  { key: "roleBasedAccess", label: "Role-Based Access", group: "Collaboration" },
  { key: "restApi", label: "REST API Access", group: "Collaboration" },
  { key: "corsSupport", label: "CORS Support", group: "Infrastructure" },
  { key: "selfHostable", label: "Self-Hostable", group: "Infrastructure" },
];

const reasons = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "All-in-One Platform",
    description: "Stop juggling between Webhook.site for captures, MockAPI for mocks, and Postman for replays. HookTrap combines webhook capture, mock API building, and request replay in a single tool.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    title: "Fake SMTP Inbox",
    description: "Capture all outgoing emails from your app during development. Point your SMTP config to HookTrap and preview HTML emails, inspect headers, and download attachments — without ever emailing real customers.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    title: "200+ Dynamic Data Generators",
    description: "Generate realistic fake data with built-in templates like {{faker.name}}, {{faker.email}}, {{faker.uuid}}, and 200+ more. No plugins, no setup — it just works.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: "Built for Teams",
    description: "Share workspaces with your team, assign roles (viewer, editor, admin), and collaborate on mock APIs and webhook endpoints. Everyone sees the same data in real time.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0H9.75m0 0V16.5m0-4.125h4.5M8.25 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "OpenAPI Import",
    description: "Drop in your OpenAPI/Swagger spec and HookTrap auto-generates mock endpoints with realistic responses. Go from spec to working mock in seconds, not hours.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
      </svg>
    ),
    title: "One-Click Replay",
    description: "Captured a webhook but your server was down? Replay any request with one click. Modify headers and body before resending to test edge cases.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Spam Score & HTML Check",
    description: "Analyze your emails for spam triggers before they hit real inboxes. Validate HTML/CSS compatibility across popular email clients like Gmail, Outlook, and Apple Mail.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: "Free & Self-Hostable",
    description: "No vendor lock-in. Deploy HookTrap on your own infrastructure with Docker, or use our hosted version. Your data stays yours.",
  },
];

/* ──────────────────────────────────────────────────────────────
   Components
   ────────────────────────────────────────────────────────────── */

function Check() {
  return (
    <svg className="w-5 h-5 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="w-4 h-4 text-slate-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */

export default function WhyHookTrapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-slate-100">
        <div className="w-full flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-slate-900">HookTrap</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/docs" target="_blank" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 font-medium transition-colors rounded-lg hover:bg-slate-50">
              Docs
            </Link>
            <Link href="/auth/login" className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ Hero ═══ */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Free & Open Source
          </div>
          <h1 className="text-4xl sm:text-5xl 2xl:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Why Choose{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              HookTrap
            </span>
            ?
          </h1>
          <p className="mt-6 text-lg sm:text-xl 2xl:text-2xl text-slate-500 leading-relaxed max-w-2xl mx-auto">
            The only platform that combines webhook capture, mock API building,
            fake SMTP inbox, and request replay in one developer-friendly tool.
          </p>
        </div>
      </section>

      {/* ═══ Why HookTrap ═══ */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl 2xl:text-4xl font-bold text-slate-900 text-center mb-4">
            Everything You Need, Nothing You Don&apos;t
          </h2>
          <p className="text-slate-500 text-center mb-12 text-lg max-w-2xl mx-auto">
            Other tools make you pay for one feature. HookTrap gives you the full toolkit.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {reasons.map((reason) => (
              <div
                key={reason.title}
                className="group bg-white border border-slate-200 rounded-xl p-6 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                  {reason.icon}
                </div>
                <h3 className="text-lg 2xl:text-xl font-semibold text-slate-900 mb-2">
                  {reason.title}
                </h3>
                <p className="text-sm 2xl:text-base text-slate-500 leading-relaxed">
                  {reason.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Comparison Table ═══ */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl 2xl:text-4xl font-bold text-slate-900 text-center mb-4">
            How HookTrap Compares
          </h2>
          <p className="text-slate-500 text-center mb-12 text-lg max-w-2xl mx-auto">
            See how HookTrap stacks up against other popular webhook and mock API tools.
          </p>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm 2xl:text-base">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="text-left px-5 py-4 font-semibold text-slate-700 sticky left-0 bg-slate-50/80 min-w-[180px]">
                      Feature
                    </th>
                    {competitors.map((c) => (
                      <th
                        key={c.name}
                        className={`px-4 py-4 text-center font-semibold min-w-[120px] ${
                          c.highlight
                            ? "text-indigo-700 bg-indigo-50/60"
                            : "text-slate-600"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          {c.highlight && (
                            <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">
                              Ours
                            </span>
                          )}
                          {c.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row, i) => {
                    const showGroupHeader =
                      row.group && (i === 0 || featureRows[i - 1].group !== row.group);
                    return (
                      <Fragment key={row.key}>
                        {showGroupHeader && (
                          <tr className="bg-slate-100/60">
                            <td
                              className="px-5 py-2 text-[11px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-400 sticky left-0 bg-slate-100/60"
                              colSpan={1}
                            >
                              {row.group}
                            </td>
                            {competitors.map((c) => (
                              <td
                                key={c.name}
                                className={`px-4 py-2 ${c.highlight ? "bg-indigo-50/40" : ""}`}
                              />
                            ))}
                          </tr>
                        )}
                        <tr
                          className={`border-b border-slate-50 ${
                            i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                          } hover:bg-slate-50/60 transition-colors`}
                        >
                          <td className="px-5 py-3.5 font-medium text-slate-700 sticky left-0 bg-inherit">
                            {row.label}
                          </td>
                          {competitors.map((c) => (
                            <td
                              key={c.name}
                              className={`px-4 py-3.5 text-center ${
                                c.highlight ? "bg-indigo-50/30" : ""
                              }`}
                            >
                              {c[row.key] ? <Check /> : <Cross />}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    );
                  })}
                  {/* Free Tier row */}
                  <tr className="border-b border-slate-50 bg-white hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700 sticky left-0 bg-inherit">
                      Free Tier
                    </td>
                    {competitors.map((c) => (
                      <td
                        key={c.name}
                        className={`px-4 py-3.5 text-center text-xs 2xl:text-sm font-medium ${
                          c.highlight
                            ? "bg-indigo-50/30 text-indigo-600"
                            : "text-slate-500"
                        }`}
                      >
                        {c.freeTier}
                      </td>
                    ))}
                  </tr>
                  {/* Pricing row */}
                  <tr className="bg-slate-50/50 hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700 sticky left-0 bg-inherit">
                      Pricing
                    </td>
                    {competitors.map((c) => (
                      <td
                        key={c.name}
                        className={`px-4 py-3.5 text-center text-xs 2xl:text-sm font-semibold ${
                          c.highlight
                            ? "bg-indigo-50/30 text-indigo-600"
                            : "text-slate-500"
                        }`}
                      >
                        {c.pricing}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center mt-4">
            Comparison based on publicly available information as of 2026. Features may change.
          </p>
        </div>
      </section>

      {/* ═══ The Problem / Solution ═══ */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Problem */}
            <div className="bg-red-50/50 border border-red-100 rounded-xl p-8">
              <div className="w-10 h-10 rounded-lg bg-red-100 text-red-500 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-xl 2xl:text-2xl font-bold text-slate-900 mb-4">Without HookTrap</h3>
              <ul className="space-y-3">
                {[
                  "Webhook.site for captures, but no mock APIs",
                  "Mailtrap for email testing — $14.99/mo and up",
                  "MockAPI.io for mocks, but no webhook capture",
                  "Risk of sending test emails to real customers",
                  "Multiple subscriptions eating your budget",
                  "Context-switching between 4-5 different tools",
                  "No shared workspace for team collaboration",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm 2xl:text-base text-slate-600">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Solution */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-8">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-500 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl 2xl:text-2xl font-bold text-slate-900 mb-4">With HookTrap</h3>
              <ul className="space-y-3">
                {[
                  "Capture + Mock + Replay + Fake Inbox in one platform",
                  "Safe email testing — never email real customers",
                  "Spam analysis & HTML validation built-in",
                  "200+ dynamic data generators built-in",
                  "Import OpenAPI specs in seconds",
                  "Free and open source — no surprise bills",
                  "One tool, one tab, one workflow",
                  "Team workspaces with role-based access",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm 2xl:text-base text-slate-600">
                    <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl px-8 py-14 shadow-xl shadow-indigo-200/50">
          <h2 className="text-3xl 2xl:text-4xl font-bold text-white mb-4">
            Ready to simplify your workflow?
          </h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-lg mx-auto">
            Join developers who use HookTrap to capture webhooks and build mock APIs — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/login"
              className="inline-flex items-center px-6 py-3 text-base font-semibold text-indigo-600 bg-white rounded-lg hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Get Started Free
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/docs"
              target="_blank"
              className="inline-flex items-center px-6 py-3 text-base font-semibold text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-slate-100 py-8">
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-400">
          &copy; {new Date().getFullYear()} HookTrap. Open source and free forever.
        </div>
      </footer>
    </div>
  );
}
