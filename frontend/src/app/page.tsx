import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" />
      </svg>
    ),
    title: "Webhook Capture",
    description:
      "Instantly capture webhooks from Stripe, GitHub, Slack, and any service. Inspect headers, body, and metadata in real time.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
      </svg>
    ),
    title: "Mock API Builder",
    description:
      "Define endpoints with dynamic responses, template variables, conditional rules, and response sequences. No backend needed.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M21.015 4.356v4.992" />
      </svg>
    ),
    title: "Request Replay",
    description:
      "Replay captured requests with a single click. Modify headers and body before resending. Debug integrations faster.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
    title: "Team Workspaces",
    description:
      "Collaborate with your team in shared workspaces. Everyone gets access to the same mock APIs, endpoints, and captured data.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    title: "OpenAPI Import",
    description:
      "Import your OpenAPI/Swagger specs and auto-generate fully functional mock endpoints. Go from spec to working API in seconds.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    ),
    title: "Real-time Logs",
    description:
      "Stream request logs as they happen. Filter by method, status, and path. Never miss a webhook or API call again.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* ── Gradient mesh background ── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
        <div className="animate-float-slow absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="animate-float-slower absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="animate-float-slowest absolute bottom-0 left-1/3 h-[600px] w-[600px] rounded-full bg-indigo-600/8 blur-[140px]" />
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500">
            <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight">HookTrap</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <a href="#features" className="hidden sm:inline-flex rounded-lg px-4 py-2 text-base font-medium text-slate-400 transition-colors hover:text-white">
            Features
          </a>
          <Link href="/why" className="hidden sm:inline-flex rounded-lg px-4 py-2 text-base font-medium text-slate-400 transition-colors hover:text-white">
            Why HookTrap
          </Link>
          <Link href="/pricing" className="hidden sm:inline-flex rounded-lg px-4 py-2 text-base font-medium text-slate-400 transition-colors hover:text-white">
            Pricing
          </Link>
          <Link href="/faq" className="hidden md:inline-flex rounded-lg px-4 py-2 text-base font-medium text-slate-400 transition-colors hover:text-white">
            FAQ
          </Link>
          <Link href="/docs" className="hidden md:inline-flex rounded-lg px-4 py-2 text-base font-medium text-slate-400 transition-colors hover:text-white">
            Docs
          </Link>
          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block" />
          <Link
            href="/auth/login"
            className="rounded-lg px-5 py-2.5 text-base font-medium text-slate-300 transition-colors hover:text-white"
          >
            Log In
          </Link>
          <Link
            href="/auth/login"
            className="rounded-xl bg-white/10 px-6 py-2.5 text-base font-medium backdrop-blur-sm transition-all hover:bg-white/15 border border-white/10"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-32 pb-32 text-center lg:px-8 lg:pt-44 lg:pb-40">
        {/* Badge */}
        <div className="animate-reveal mb-10 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-base text-slate-300 backdrop-blur-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Now in public beta
        </div>

        {/* Headline */}
        <h1 className="animate-reveal animate-delay-100 mx-auto max-w-5xl text-6xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
          Capture, mock, and{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            replay webhooks
          </span>{" "}
          in seconds
        </h1>

        {/* Subtitle */}
        <p className="animate-reveal animate-delay-200 mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-slate-400 sm:text-2xl">
          The developer-first platform for webhook testing and mock API creation.
          Unblock your frontend team with instant, shareable endpoints.
        </p>

        {/* CTA Buttons */}
        <div className="animate-reveal animate-delay-300 mt-12 flex flex-col items-center justify-center gap-5 sm:flex-row">
          <Link
            href="/auth/login"
            className="group relative inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110"
          >
            Start Free
            <svg className="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <a
            href="#features"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-10 py-4 text-lg font-medium text-slate-300 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            See Features
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>
          </a>
        </div>

        {/* Social proof hint */}
        <p className="animate-reveal animate-delay-400 mt-16 text-base text-slate-500">
          No credit card required &middot; Generous free tier &middot; Set up in 30 seconds
        </p>
      </section>

      {/* ── Features Section ── */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-7xl px-6 pb-32 pt-24 lg:px-8"
      >
        {/* Section header */}
        <div className="animate-reveal mb-20 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              ship faster
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-slate-400">
            A complete toolkit for webhook testing, API mocking, and team collaboration.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`animate-reveal animate-delay-${(i + 1) * 100} group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.06] sm:p-10`}
            >
              {/* Hover glow effect */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(600px_circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(99,102,241,0.06),transparent_40%)]" />

              <div className="relative">
                <div className="mb-5 inline-flex rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 p-4 text-indigo-400 ring-1 ring-inset ring-white/[0.08]">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-base leading-relaxed text-slate-400">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-32 lg:px-8">
        <div className="animate-reveal relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 via-slate-900 to-violet-500/10 p-16 text-center sm:p-20">
          {/* Inner glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)]" />

          <div className="relative">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Ready to simplify webhook testing?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-xl text-slate-400">
              Join developers who use HookTrap to capture webhooks, mock APIs, and
              ship integrations faster.
            </p>
            <div className="mt-10">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110"
              >
                Get Started for Free
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2.5 text-base text-slate-500">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-violet-500">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              HookTrap
            </div>
            <nav className="flex items-center gap-8">
              <a href="#features" className="text-base text-slate-500 hover:text-slate-300 transition-colors">Features</a>
              <Link href="/pricing" className="text-base text-slate-500 hover:text-slate-300 transition-colors">Pricing</Link>
              <Link href="/faq" className="text-base text-slate-500 hover:text-slate-300 transition-colors">FAQ</Link>
              <Link href="/docs" className="text-base text-slate-500 hover:text-slate-300 transition-colors">Docs</Link>
            </nav>
            <p className="text-base text-slate-600">
              &copy; {new Date().getFullYear()} HookTrap. Built for developers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
