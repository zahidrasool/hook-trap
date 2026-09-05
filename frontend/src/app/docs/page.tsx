import type { Metadata } from "next";
import Link from "next/link";
import {
  Callout,
  H2,
  H3,
  P,
  Steps,
  Step,
  UL,
  LI,
  Divider,
} from "./_components";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How to capture webhooks, build mock APIs, import an OpenAPI spec and receive test email with MockLane. Start here.",
  alternates: { canonical: "/docs" },
};

export default function DocsIndexPage() {
  return (
    <>
      {/* Quick-start cards. These used to be in-page anchors; each now points
          at the route that owns the topic. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-16">
        {[
          { href: "/docs/webhook-capture#capture-overview", icon: "M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3", label: "Webhook Capture", desc: "Start capturing in 60s" },
          { href: "/docs/mock-apis#mock-overview", icon: "M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z", label: "Mock APIs", desc: "121 data generators" },
          { href: "/docs/importing#openapi-import", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", label: "Import Specs", desc: "OpenAPI & YAML config" },
        ].map((card) => (
          <Link key={card.href} href={card.href} className="group flex flex-col p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-all">
            <svg className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={card.icon} /></svg>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">{card.label}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{card.desc}</span>
          </Link>
        ))}
      </div>

      <H2 id="getting-started">Getting Started</H2>

      <H3 id="overview">Overview</H3>
      <P>
        MockLane is a developer platform that combines <strong>webhook capture</strong> and <strong>mock API building</strong> into one tool. It helps you:
      </P>
      <UL>
        <LI>Create unique URLs to receive and inspect incoming webhook payloads from any service (Stripe, GitHub, Slack, Twilio, etc.).</LI>
        <LI>Define mock API endpoints with dynamic responses, template variables, conditional rules, and response sequences &mdash; no backend needed.</LI>
        <LI>Collaborate with team members in shared workspaces with role-based access control.</LI>
      </UL>

      <H3 id="create-account">Create an Account</H3>
      <P>MockLane uses <strong>passwordless magic link</strong> authentication. No passwords to remember.</P>
      <Steps>
        <Step n={1}>Navigate to the <Link href="/auth/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Login page</Link>.</Step>
        <Step n={2}>Enter your email address and click <strong>Send Magic Link</strong>.</Step>
        <Step n={3}>Check your inbox and click the link in the email from MockLane.</Step>
        <Step n={4}>You&apos;ll be automatically signed in and redirected to your Dashboard.</Step>
      </Steps>
      <Callout type="tip">Magic links expire after 15 minutes. If you don&apos;t see the email, check your spam folder.</Callout>

      <H3 id="dashboard-tour">Dashboard Tour</H3>
      <P>After signing in, the Dashboard is your home base:</P>
      <UL>
        <LI><strong>Left Sidebar</strong> &mdash; Navigate between Dashboard, Captures, Settings, and your Workspaces.</LI>
        <LI><strong>Dashboard</strong> &mdash; Overview of recent activity, quick stats (captures, active mocks, workspaces).</LI>
        <LI><strong>Captures</strong> &mdash; Chronological log of all received webhooks.</LI>
        <LI><strong>Workspaces</strong> &mdash; Isolated project spaces containing mock endpoints, members, and configs.</LI>
      </UL>

      <Divider />

      {/* ─────────────────────────────────────────────────
          WORKSPACES
          ───────────────────────────────────────────────── */}
    </>
  );
}
