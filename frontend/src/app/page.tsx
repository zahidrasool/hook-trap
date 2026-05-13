import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">HookTrap</h1>
        <div className="flex gap-4">
          <Link
            href="/auth/login"
            className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
          >
            Log In
          </Link>
          <Link
            href="/auth/login"
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-24 text-center">
        <h2 className="text-5xl font-bold mb-6">
          Webhook Testing &<br />Mock API Platform
        </h2>
        <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
          Capture, inspect, and replay webhooks. Create mock APIs for your team.
          Unblock frontend development with instant mock endpoints.
        </p>

        <div className="flex gap-4 justify-center mb-16">
          <Link
            href="/auth/login"
            className="px-8 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-lg font-semibold transition"
          >
            Start Free
          </Link>
          <a
            href="#features"
            className="px-8 py-3 rounded-lg border border-white/20 hover:bg-white/10 text-lg transition"
          >
            Learn More
          </a>
        </div>

        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mt-24">
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-semibold mb-3">Webhook Sandbox</h3>
            <p className="text-slate-400">
              Capture webhooks from Stripe, GitHub, Slack, and more.
              Inspect headers, body, and replay instantly.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-semibold mb-3">Mock API Server</h3>
            <p className="text-slate-400">
              Define mock endpoints with dynamic responses.
              Template variables, conditional rules, and sequences.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-semibold mb-3">Team Collaboration</h3>
            <p className="text-slate-400">
              Share workspaces with your team. Everyone uses the same
              mock APIs. Import OpenAPI specs instantly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
