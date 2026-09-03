"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PublicHeader } from "@/components/layout/PublicHeader";

/* ──────────────────────────────────────────────────────────────
   Table of Contents data
   ────────────────────────────────────────────────────────────── */

const TOC = [
  {
    id: "getting-started",
    title: "Getting Started",
    sections: [
      { id: "overview", title: "Overview" },
      { id: "create-account", title: "Create an Account" },
      { id: "dashboard-tour", title: "Dashboard Tour" },
    ],
  },
  {
    id: "workspaces",
    title: "Workspaces",
    sections: [
      { id: "create-workspace", title: "Creating a Workspace" },
      { id: "workspace-settings", title: "Workspace Settings" },
      { id: "invite-members", title: "Inviting Team Members" },
      { id: "workspace-roles", title: "Roles & Permissions" },
      { id: "public-private", title: "Public vs Private" },
      { id: "api-keys", title: "API Keys" },
    ],
  },
  {
    id: "webhook-capture",
    title: "Webhook Capture",
    sections: [
      { id: "capture-overview", title: "How Capture Works" },
      { id: "create-endpoint", title: "Creating an Endpoint" },
      { id: "inspect-captures", title: "Inspecting Captures" },
      { id: "replay-requests", title: "Replaying Requests" },
    ],
  },
  {
    id: "mock-apis",
    title: "Mock APIs",
    sections: [
      { id: "mock-overview", title: "Overview" },
      { id: "create-mock", title: "Creating a Mock" },
      { id: "response-body", title: "Response Body & Status" },
      { id: "template-engine", title: "Template Engine" },
      { id: "generator-reference", title: "Generator Reference" },
      { id: "response-rules", title: "Conditional Rules" },
      { id: "response-sequences", title: "Sequences" },
      { id: "static-data", title: "Static Data Mode" },
      { id: "immutable-mode", title: "Immutable Mode" },
      { id: "error-simulation", title: "Error Simulation" },
      { id: "mock-url", title: "Mock URL" },
    ],
  },
  {
    id: "importing",
    title: "Importing",
    sections: [
      { id: "openapi-import", title: "OpenAPI / Swagger" },
      { id: "yaml-config-import", title: "YAML Config" },
    ],
  },
  {
    id: "rest-api",
    title: "REST API",
    sections: [
      { id: "rest-endpoints", title: "Endpoints" },
      { id: "rest-query", title: "Query Parameters" },
      { id: "rest-operators", title: "Operators" },
      { id: "rest-sort", title: "Sort & Paginate" },
      { id: "rest-nested", title: "Nested Resources" },
    ],
  },
  {
    id: "fake-inbox",
    title: "Fake Inbox",
    sections: [
      { id: "inbox-overview", title: "Overview" },
      { id: "inbox-setup", title: "SMTP Configuration" },
      { id: "inbox-usage", title: "Using the Inbox" },
      { id: "inbox-frameworks", title: "Framework Examples" },
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    sections: [
      { id: "request-logs", title: "Request Logs" },
      { id: "contract-validation", title: "Contract Validation" },
      { id: "cors-support", title: "CORS Support" },
      { id: "rate-limiting", title: "Rate Limiting" },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────
   Reusable components (Nextra-like style)
   ────────────────────────────────────────────────────────────── */

function CodeBlock({ children, title, lang }: { children: string; title?: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-5 group relative">
      {title && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-t-lg border border-b-0 border-slate-700/50 text-xs text-slate-400 font-mono uppercase tracking-wider">
          {lang && <span className="text-indigo-400">{lang}</span>}
          {lang && title && <span className="text-slate-600">&middot;</span>}
          <span>{title}</span>
        </div>
      )}
      <div className={cn("relative", title ? "rounded-b-lg" : "rounded-lg")}>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all text-xs"
          title="Copy"
        >
          {copied ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
          )}
        </button>
        <pre className="bg-slate-900 dark:bg-slate-900 text-slate-200 p-4 overflow-x-auto text-[13px] 2xl:text-sm leading-relaxed border border-slate-700/50 dark:border-slate-800">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[13px] px-1.5 py-0.5 rounded-md font-mono border border-slate-200/60 dark:border-slate-700">
      {children}
    </code>
  );
}

function Callout({ type = "info", children }: { type?: "info" | "warning" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: "border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200",
    warning: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200",
    tip: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200",
  };
  const icons = {
    info: (
      <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    tip: (
      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
  };
  return (
    <div className={cn("my-5 border-l-4 rounded-r-lg px-5 py-4 flex gap-3", styles[type])}>
      {icons[type]}
      <div className="text-sm 2xl:text-base leading-relaxed">{children}</div>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl 2xl:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-16 mb-4 scroll-mt-20 group flex items-center gap-2">
      {children}
      <a href={`#${id}`} className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-opacity" aria-label="Link to this section">#</a>
    </h2>
  );
}

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-lg 2xl:text-xl font-semibold text-slate-800 dark:text-slate-200 mt-10 mb-3 scroll-mt-20 group flex items-center gap-2">
      {children}
      <a href={`#${id}`} className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-opacity text-base" aria-label="Link to this section">#</a>
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] 2xl:text-base text-slate-600 dark:text-slate-300 leading-7 2xl:leading-8 mb-4">{children}</p>;
}

function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="my-5 space-y-3 list-none counter-reset-step pl-0">
      {children}
    </ol>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5 text-[15px] 2xl:text-base text-slate-600 dark:text-slate-300 leading-7 2xl:leading-8">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-sm font-semibold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="my-4 space-y-2 list-none pl-0">{children}</ul>;
}

function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[15px] 2xl:text-base text-slate-600 dark:text-slate-300 leading-7 2xl:leading-8">
      <span className="text-indigo-400 mt-2.5 flex-shrink-0">
        <svg className="w-1.5 h-1.5" fill="currentColor" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3"/></svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    POST: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    PUT: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    PATCH: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
    DELETE: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  };
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase border", colors[method] || colors.GET)}>
      {method}
    </span>
  );
}

function Endpoint({ method, path, description }: { method: string; path: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 text-[15px] 2xl:text-base">
      <MethodBadge method={method} />
      <code className="font-mono text-sm 2xl:text-base text-slate-700 dark:text-slate-200">{path}</code>
      {description && <span className="text-slate-400 dark:text-slate-500 text-sm 2xl:text-base ml-auto hidden sm:inline">{description}</span>}
    </div>
  );
}

function Divider() {
  return <hr className="my-10 border-slate-200/60 dark:border-slate-800" />;
}

/* ──────────────────────────────────────────────────────────────
   GENERATOR REFERENCE DATA
   ────────────────────────────────────────────────────────────── */

const GENERATORS = [
  {
    name: "Identity",
    items: [
      ["{{faker.firstName}}", "Emma"],
      ["{{faker.lastName}}", "Johnson"],
      ["{{faker.fullName}}", "Emma Johnson"],
      ["{{faker.email}}", "emma@example.com"],
      ["{{faker.username}}", "emma_j92"],
      ["{{faker.phone}}", "+1-555-0142"],
      ["{{faker.avatar}}", "https://i.pravatar.cc/150?u=..."],
    ],
  },
  {
    name: "Location",
    items: [
      ["{{faker.city}}", "San Francisco"],
      ["{{faker.country}}", "United States"],
      ["{{faker.address}}", "123 Main St"],
      ["{{faker.zipCode}}", "94102"],
      ["{{faker.latitude}}", "37.7749"],
      ["{{faker.longitude}}", "-122.4194"],
    ],
  },
  {
    name: "Internet",
    items: [
      ["{{faker.url}}", "https://example.com/page"],
      ["{{faker.domain}}", "example.com"],
      ["{{faker.ipv4}}", "192.168.1.42"],
      ["{{faker.ipv6}}", "2001:0db8:85a3:..."],
      ["{{faker.userAgent}}", "Mozilla/5.0 ..."],
      ["{{faker.slug}}", "my-awesome-post"],
    ],
  },
  {
    name: "Numbers & IDs",
    items: [
      ["{{randomUUID}}", "550e8400-e29b-41d4-..."],
      ["{{randomInt 1 1000}}", "42"],
      ["{{randomFloat 0 100 2}}", "73.25"],
      ["{{autoIncrement}}", "1, 2, 3, ..."],
    ],
  },
  {
    name: "Date & Time",
    items: [
      ["{{now}}", "2026-04-12T10:30:00Z"],
      ["{{faker.pastDate}}", "2025-08-14"],
      ["{{faker.futureDate}}", "2027-01-20"],
      ["{{faker.timestamp}}", "1744468200"],
    ],
  },
  {
    name: "Commerce",
    items: [
      ["{{faker.price}}", "29.99"],
      ["{{faker.productName}}", "Wireless Headphones"],
      ["{{faker.companyName}}", "Acme Corp"],
      ["{{faker.currencyCode}}", "USD"],
    ],
  },
  {
    name: "Text",
    items: [
      ["{{faker.word}}", "synergy"],
      ["{{faker.sentence}}", "The quick brown fox..."],
      ["{{faker.paragraph}}", "Lorem ipsum dolor sit..."],
      ["{{faker.title}}", "Senior Developer"],
    ],
  },
  {
    name: "Color & Media",
    items: [
      ["{{faker.hexColor}}", "#3B82F6"],
      ["{{faker.rgbColor}}", "rgb(59, 130, 246)"],
      ["{{faker.imageUrl}}", "https://picsum.photos/..."],
      ["{{faker.mimeType}}", "application/json"],
    ],
  },
];

/* ──────────────────────────────────────────────────────────────
   MAIN PAGE
   ────────────────────────────────────────────────────────────── */

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Intersection observer for active TOC highlighting
  useEffect(() => {
    const headings = document.querySelectorAll("h2[id], h3[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  // Flatten for search
  const allSections = TOC.flatMap((g) => g.sections.map((s) => ({ ...s, group: g.title })));
  const searchResults = searchQuery.trim()
    ? allSections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.group.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Find current group for "On This Page" sidebar
  const currentGroup = TOC.find((g) =>
    g.sections.some((s) => s.id === activeSection)
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">

      {/* ═══ Shared site header ═══ */}
      <PublicHeader />

      {/* ═══ Docs toolbar: mobile menu, breadcrumb, search ═══ */}
      <div className="sticky top-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800">
        <div className="w-full flex items-center justify-between gap-4 h-14 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="p-2 -ml-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Toggle documentation menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Documentation</span>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="relative w-full max-w-xs sm:max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="w-full px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 dark:focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400"
              />
              {searchQuery && searchResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-72 overflow-auto z-50">
                  {searchResults.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      onClick={() => setSearchQuery("")}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-200">{s.title}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{s.group}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <Link href="/dashboard" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex-shrink-0">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full flex">

        {/* ═══ Left Sidebar ═══ */}
        {mobileNavOpen && (
          <div className="fixed inset-0 bg-black/20 dark:bg-black/60 z-[65] lg:hidden" onClick={() => setMobileNavOpen(false)} />
        )}
        <aside
          className={cn(
            "fixed top-0 h-screen lg:sticky lg:top-14 z-[70] lg:z-auto lg:h-[calc(100vh-3.5rem)] w-72 bg-white dark:bg-slate-950 border-r border-slate-100 dark:border-slate-800 overflow-y-auto flex-shrink-0 transform transition-transform duration-200 lg:transform-none lg:block",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <nav className="p-4 space-y-8 pt-6">
            {TOC.map((group) => (
              <div key={group.id}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-3">
                  {group.title}
                </h4>
                <ul className="space-y-0.5">
                  {group.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "block px-3 py-1.5 text-[13px] 2xl:text-sm rounded-md transition-colors duration-100",
                          activeSection === section.id
                            ? "text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 font-semibold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* ═══ Main Content ═══ */}
        <main className="flex-1 min-w-0 px-6 py-12 lg:px-12 xl:px-16 max-w-4xl xl:max-w-5xl">

          {/* Page title */}
          <div className="mb-12">
            <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 mb-4">
              <Link href="/" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              <span className="text-slate-600 dark:text-slate-300">Documentation</span>
            </div>
            <h1 className="text-4xl 2xl:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              MockLane Documentation
            </h1>
            <p className="mt-4 text-lg 2xl:text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl 2xl:max-w-3xl">
              Capture webhooks, build mock APIs with dynamic data generators, and accelerate your integration development.
            </p>
          </div>

          {/* Quick-start cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-16">
            {[
              { href: "#capture-overview", icon: "M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3", label: "Webhook Capture", desc: "Start capturing in 60s" },
              { href: "#mock-overview", icon: "M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z", label: "Mock APIs", desc: "200+ data generators" },
              { href: "#openapi-import", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", label: "Import Specs", desc: "OpenAPI & YAML config" },
            ].map((card) => (
              <a key={card.href} href={card.href} className="group flex flex-col p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-all">
                <svg className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={card.icon} /></svg>
                <span className="font-semibold text-sm text-slate-900 dark:text-white">{card.label}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{card.desc}</span>
              </a>
            ))}
          </div>

          {/* ─────────────────────────────────────────────────
              GETTING STARTED
              ───────────────────────────────────────────────── */}
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
          <H2 id="workspaces">Workspaces</H2>

          <H3 id="create-workspace">Creating a Workspace</H3>
          <P>Workspaces organize mock endpoints and team members into separate projects.</P>
          <Steps>
            <Step n={1}>Click <strong>New Workspace</strong> in the left sidebar.</Step>
            <Step n={2}>Enter a name (e.g., &quot;Payment Integration&quot;, &quot;Mobile App API&quot;).</Step>
            <Step n={3}>Click <strong>Create Workspace</strong>.</Step>
          </Steps>

          <H3 id="workspace-settings">Workspace Settings</H3>
          <P>Navigate to your workspace &rarr; <strong>Settings</strong> tab to:</P>
          <UL>
            <LI>Rename the workspace.</LI>
            <LI>Toggle public / private visibility.</LI>
            <LI>Generate or regenerate the API key.</LI>
            <LI>Delete the workspace (irreversible).</LI>
          </UL>

          <H3 id="invite-members">Inviting Team Members</H3>
          <Steps>
            <Step n={1}>Go to your workspace &rarr; <strong>Members</strong> tab.</Step>
            <Step n={2}>Enter the email of the person you want to invite.</Step>
            <Step n={3}>Select their role: <InlineCode>viewer</InlineCode>, <InlineCode>editor</InlineCode>, or <InlineCode>admin</InlineCode>.</Step>
            <Step n={4}>Click <strong>Invite</strong>. They&apos;ll receive an email with a link to join.</Step>
          </Steps>

          <H3 id="workspace-roles">Roles & Permissions</H3>
          <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-200">Role</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">View</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">Create/Edit</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">Delete</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">Manage Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  { role: "Viewer", perms: [true, false, false, false] },
                  { role: "Editor", perms: [true, true, false, false] },
                  { role: "Admin", perms: [true, true, true, true] },
                ].map((row) => (
                  <tr key={row.role}>
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{row.role}</td>
                    {row.perms.map((ok, i) => (
                      <td key={i} className="px-4 py-2.5 text-center">
                        {ok ? (
                          <svg className="w-4 h-4 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-slate-200 dark:text-slate-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H3 id="public-private">Public vs Private Workspaces</H3>
          <P>
            By default, workspaces are <strong>public</strong> &mdash; anyone with the mock URL can call the endpoints. This is ideal for quick prototyping.
          </P>
          <P>
            <strong>Private workspaces</strong> require an API key in every request. Toggle this in Workspace Settings.
          </P>
          <CodeBlock title="Private workspace request" lang="bash">{`curl -H "X-API-Key: your-workspace-api-key" \\
  https://mocklane.com/m/abc-xyz/api/users`}</CodeBlock>

          <H3 id="api-keys">API Keys</H3>
          <P>
            When you make a workspace private, an API key is automatically generated. Pass it via the <InlineCode>X-API-Key</InlineCode> header or <InlineCode>?api_key=</InlineCode> query parameter.
          </P>
          <Callout type="warning">
            Regenerating an API key immediately invalidates the old one. Update all consumers before regenerating.
          </Callout>

          <Divider />

          {/* ─────────────────────────────────────────────────
              WEBHOOK CAPTURE
              ───────────────────────────────────────────────── */}
          <H2 id="webhook-capture">Webhook Capture</H2>

          <H3 id="capture-overview">How Capture Works</H3>
          <P>
            MockLane gives you unique URLs that accept <strong>any HTTP request</strong> and stores the complete request data &mdash; headers, body, query parameters, and metadata &mdash; for inspection.
          </P>
          <CodeBlock title="Capture URL format" lang="http">{`POST https://mocklane.com/h/{endpoint-short-id}

# Your unique capture URL accepts any method:
# GET, POST, PUT, DELETE, PATCH, etc.`}</CodeBlock>

          <H3 id="create-endpoint">Creating an Endpoint</H3>
          <Steps>
            <Step n={1}>Go to the <strong>Dashboard</strong> and click <strong>Create Endpoint</strong>.</Step>
            <Step n={2}>You&apos;ll receive a unique URL like <InlineCode>https://mocklane.com/h/abc123</InlineCode>.</Step>
            <Step n={3}>Copy this URL and paste it as the webhook URL in your service&apos;s settings (Stripe, GitHub, etc.).</Step>
            <Step n={4}>Requests sent to this URL will appear in your <strong>Captures</strong> page in real time.</Step>
          </Steps>
          <Callout type="tip">
            Your capture URL works with any HTTP method and content type. JSON, XML, form data, or plain text &mdash; MockLane captures everything.
          </Callout>

          <H3 id="inspect-captures">Inspecting Captures</H3>
          <P>Navigate to <strong>Captures</strong> in the sidebar. Click any capture to see:</P>
          <UL>
            <LI><strong>Headers</strong> &mdash; All HTTP headers sent with the request.</LI>
            <LI><strong>Body</strong> &mdash; Raw request body with auto-formatted JSON.</LI>
            <LI><strong>Query Parameters</strong> &mdash; URL query string values.</LI>
            <LI><strong>Metadata</strong> &mdash; Method, content type, source IP, timestamp, payload size.</LI>
          </UL>

          <H3 id="replay-requests">Replaying Requests</H3>
          <Steps>
            <Step n={1}>Open a captured request.</Step>
            <Step n={2}>Click the <strong>Replay</strong> button.</Step>
            <Step n={3}>Optionally modify the target URL, headers, or body.</Step>
            <Step n={4}>View the replay response to verify your application&apos;s behavior.</Step>
          </Steps>

          <Divider />

          {/* ─────────────────────────────────────────────────
              MOCK APIs
              ───────────────────────────────────────────────── */}
          <H2 id="mock-apis">Mock APIs</H2>

          <H3 id="mock-overview">Overview</H3>
          <P>
            Create fully functional API endpoints without server-side code. Define endpoints, set response bodies with dynamic data, and share a working API URL with your team.
          </P>
          <P>Mock endpoints are served at:</P>
          <CodeBlock lang="http">{`https://mocklane.com/m/{workspace-short-id}{path}

# Example:
GET https://mocklane.com/m/abc-xyz/api/users
GET https://mocklane.com/m/abc-xyz/api/users/42`}</CodeBlock>

          <H3 id="create-mock">Creating a Mock Endpoint</H3>
          <Steps>
            <Step n={1}>Navigate to your workspace &rarr; <strong>Mocks</strong> tab.</Step>
            <Step n={2}>Click <strong>New Mock</strong>.</Step>
            <Step n={3}>Set the HTTP method (<MethodBadge method="GET" />, <MethodBadge method="POST" />, <MethodBadge method="PUT" />, <MethodBadge method="PATCH" />, <MethodBadge method="DELETE" />).</Step>
            <Step n={4}>Set the path (e.g., <InlineCode>/api/users</InlineCode> or <InlineCode>/api/users/:id</InlineCode>).</Step>
            <Step n={5}>Click <strong>Create</strong> to open the editor.</Step>
          </Steps>
          <Callout type="tip">
            Use path parameters with a colon prefix: <InlineCode>/api/users/:id</InlineCode> matches requests like <InlineCode>/api/users/123</InlineCode>.
          </Callout>

          <H3 id="response-body">Response Body & Status</H3>
          <P>Configure the response consumers will receive:</P>
          <UL>
            <LI><strong>Status Code</strong> &mdash; 200, 201, 404, 500, etc.</LI>
            <LI><strong>Response Headers</strong> &mdash; Custom headers (<InlineCode>Content-Type</InlineCode> defaults to <InlineCode>application/json</InlineCode>).</LI>
            <LI><strong>Response Body</strong> &mdash; JSON with optional template variables.</LI>
            <LI><strong>Response Delay</strong> &mdash; Simulate latency in milliseconds.</LI>
          </UL>

          <H3 id="template-engine">Template Engine</H3>
          <P>
            Embed dynamic generators in your JSON response using <InlineCode>{"{{...}}"}</InlineCode> syntax. Each call produces fresh random values.
          </P>
          <CodeBlock title="Response body with generators" lang="json">{`{
  "id": "{{randomUUID}}",
  "name": "{{faker.fullName}}",
  "email": "{{faker.email}}",
  "age": "{{randomInt 18 65}}",
  "avatar": "{{faker.avatar}}",
  "joined": "{{now}}",
  "address": {
    "city": "{{faker.city}}",
    "country": "{{faker.country}}"
  }
}`}</CodeBlock>
          <P>Each request returns unique data:</P>
          <CodeBlock title="Example response" lang="json">{`{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Emma Johnson",
  "email": "emma.johnson@example.com",
  "age": 34,
  "avatar": "https://i.pravatar.cc/150?u=550e8400",
  "joined": "2026-04-12T10:30:00Z",
  "address": {
    "city": "San Francisco",
    "country": "United States"
  }
}`}</CodeBlock>

          <H3 id="generator-reference">Generator Reference</H3>
          <P>MockLane includes 200+ generators. Use the <strong>Template Helper</strong> picker in the editor or type them manually.</P>

          {GENERATORS.map((cat) => (
            <div key={cat.name} className="mb-6">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {cat.name}
              </h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Template</th>
                      <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cat.items.map(([tmpl, example]) => (
                      <tr key={tmpl} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">{tmpl}</td>
                        <td className="px-4 py-2 text-slate-500 dark:text-slate-400 text-[13px]">{example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <H3 id="response-rules">Conditional Response Rules</H3>
          <P>
            Return different responses based on the incoming request. Each rule has its own status code, headers, and body.
          </P>
          <P>Match conditions can test against:</P>
          <UL>
            <LI><strong>Headers</strong> &mdash; e.g., when <InlineCode>Authorization</InlineCode> contains &quot;Bearer&quot;.</LI>
            <LI><strong>Query Parameters</strong> &mdash; e.g., when <InlineCode>status=active</InlineCode>.</LI>
            <LI><strong>Body Fields</strong> &mdash; e.g., when <InlineCode>type</InlineCode> equals &quot;premium&quot;.</LI>
            <LI><strong>Path Parameters</strong> &mdash; e.g., when <InlineCode>:id</InlineCode> equals &quot;404&quot;.</LI>
          </UL>
          <P>Rules are evaluated in priority order. First match wins. If none match, the default response is returned.</P>

          <H3 id="response-sequences">Response Sequences</H3>
          <P>
            Define a series of responses returned in order, one per request. Useful for simulating state changes:
          </P>
          <CodeBlock title="Sequence example">{`Step 1 → 200 {"status": "pending"}
Step 2 → 200 {"status": "processing"}
Step 3 → 200 {"status": "completed"}
         ↩ loops back to Step 1`}</CodeBlock>
          <P>When <strong>Loop</strong> is enabled, the sequence restarts after the last step. Otherwise, the last step repeats indefinitely.</P>

          <H3 id="static-data">Static Data Mode</H3>
          <P>
            Define a fixed JSON array of records. MockLane auto-generates full CRUD behavior:
          </P>
          <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Method</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Path</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr><td className="px-4 py-2.5"><MethodBadge method="GET" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Returns full array</td></tr>
                <tr><td className="px-4 py-2.5"><MethodBadge method="GET" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users/:id</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Single record by ID</td></tr>
                <tr><td className="px-4 py-2.5"><MethodBadge method="POST" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Add record</td></tr>
                <tr><td className="px-4 py-2.5"><MethodBadge method="PUT" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users/:id</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Update record</td></tr>
                <tr><td className="px-4 py-2.5"><MethodBadge method="DELETE" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users/:id</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Remove record</td></tr>
              </tbody>
            </table>
          </div>

          <H3 id="immutable-mode">Immutable Mode</H3>
          <P>
            Enable <strong>Immutable Mode</strong> to restrict an endpoint to <MethodBadge method="GET" /> requests only. All write methods return <InlineCode>405 Method Not Allowed</InlineCode>. Useful for exposing read-only data.
          </P>

          <H3 id="error-simulation">Error Simulation</H3>
          <P>Test error handling by configuring:</P>
          <UL>
            <LI><strong>Error Rate</strong> &mdash; Percentage of requests that return an error (0&ndash;100%).</LI>
            <LI><strong>Error Status</strong> &mdash; HTTP status code for errors (e.g., 500, 503).</LI>
            <LI><strong>Error Body</strong> &mdash; Custom JSON body for error responses.</LI>
          </UL>
          <P>Example: set 20% error rate with 503 status to simulate intermittent outages.</P>

          <H3 id="mock-url">Mock URL</H3>
          <P>Every mock endpoint has a live URL displayed at the top of the editor. Use it in your frontend, mobile app, or any HTTP client:</P>
          <CodeBlock title="Usage examples" lang="bash">{`# cURL
curl https://mocklane.com/m/abc-xyz/api/users

# JavaScript
const res = await fetch("https://mocklane.com/m/abc-xyz/api/users");
const data = await res.json();

# Python
import requests
r = requests.get("https://mocklane.com/m/abc-xyz/api/users")
data = r.json()`}</CodeBlock>

          <Divider />

          {/* ─────────────────────────────────────────────────
              IMPORTING
              ───────────────────────────────────────────────── */}
          <H2 id="importing">Importing</H2>

          <H3 id="openapi-import">OpenAPI / Swagger Import</H3>
          <P>Import your OpenAPI 3.0 or Swagger 2.0 spec to auto-generate mock endpoints.</P>
          <Steps>
            <Step n={1}>Navigate to your workspace &rarr; <strong>Import</strong> tab.</Step>
            <Step n={2}>Paste your OpenAPI YAML/JSON or upload a file.</Step>
            <Step n={3}>Click <strong>Preview Endpoints</strong> to see detected paths.</Step>
            <Step n={4}>Select which endpoints to import.</Step>
            <Step n={5}>Click <strong>Import</strong>.</Step>
          </Steps>
          <P>
            Response bodies are auto-generated from your spec&apos;s response schemas, including <InlineCode>$ref</InlineCode> resolution and example values.
          </P>
          <Callout type="info">
            If your spec defines <InlineCode>example</InlineCode> values, those are used directly. Otherwise, MockLane generates realistic mock data using template generators.
          </Callout>

          <H3 id="yaml-config-import">YAML Config Import</H3>
          <P>
            Define multiple models and their relationships in a single YAML file. MockLane auto-generates full CRUD endpoints for each model.
          </P>
          <CodeBlock title="mockend.yaml" lang="yaml">{`models:
  User:
    fields:
      id: "{{randomUUID}}"
      name: "{{faker.fullName}}"
      email: "{{faker.email}}"
      avatar: "{{faker.avatar}}"
    count: 10

  Post:
    fields:
      id: "{{randomUUID}}"
      title: "{{faker.sentence}}"
      body: "{{faker.paragraph}}"
      userId: "{{ref:User.id}}"
    count: 25

  Comment:
    fields:
      id: "{{randomUUID}}"
      text: "{{faker.sentence}}"
      postId: "{{ref:Post.id}}"
      authorId: "{{ref:User.id}}"
    count: 50`}</CodeBlock>
          <P>
            This generates <InlineCode>GET /users</InlineCode>, <InlineCode>GET /users/:id</InlineCode>, <InlineCode>POST /users</InlineCode>, etc. for each model. Relationships are automatically linked using <InlineCode>{"{{ref:Model.field}}"}</InlineCode>.
          </P>
          <Steps>
            <Step n={1}>On the Mocks page, click <strong>YAML Import</strong>.</Step>
            <Step n={2}>Paste your YAML config or upload a file.</Step>
            <Step n={3}>Click <strong>Import</strong>.</Step>
          </Steps>

          <Divider />

          {/* ─────────────────────────────────────────────────
              REST API
              ───────────────────────────────────────────────── */}
          <H2 id="rest-api">REST API</H2>

          <H3 id="rest-endpoints">Endpoints</H3>
          <P>When you create a mock endpoint or import models with static data, the following REST routes are available:</P>
          <div className="my-5 space-y-1 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            <Endpoint method="GET" path="/m/{ws}/{resource}" description="List all records" />
            <Endpoint method="GET" path="/m/{ws}/{resource}/:id" description="Get single record" />
            <Endpoint method="POST" path="/m/{ws}/{resource}" description="Create record" />
            <Endpoint method="PUT" path="/m/{ws}/{resource}/:id" description="Replace record" />
            <Endpoint method="PATCH" path="/m/{ws}/{resource}/:id" description="Update record" />
            <Endpoint method="DELETE" path="/m/{ws}/{resource}/:id" description="Delete record" />
          </div>

          <H3 id="rest-query">Query Parameters</H3>
          <P>Filter, sort, and paginate results using query parameters:</P>
          <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Parameter</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?field_eq=value</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Equals</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?status_eq=active</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?field_ne=value</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Not equals</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?role_ne=guest</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?field_gt=value</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Greater than</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?age_gt=18</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?field_lt=value</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Less than</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?price_lt=100</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?q=keyword</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Full-text search</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?q=emma</td></tr>
              </tbody>
            </table>
          </div>

          <H3 id="rest-operators">Operators</H3>
          <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Suffix</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Operator</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_eq</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">==</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Equal to</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_ne</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">!=</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Not equal</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_gt</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">&gt;</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Greater than</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_gte</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">&gt;=</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Greater or equal</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_lt</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">&lt;</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Less than</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_lte</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">&lt;=</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Less or equal</td></tr>
              </tbody>
            </table>
          </div>

          <H3 id="rest-sort">Sort & Paginate</H3>
          <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Parameter</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_sort</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Sort by field</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?_sort=name</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_order</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Sort direction</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?_order=desc</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_limit</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Max records</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?_limit=10</td></tr>
                <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_offset</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Skip records</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?_offset=20</td></tr>
              </tbody>
            </table>
          </div>
          <CodeBlock title="Example: sorted & paginated" lang="http">{`GET /m/abc-xyz/api/users?_sort=name&_order=asc&_limit=10&_offset=0`}</CodeBlock>

          <H3 id="rest-nested">Nested Resources</H3>
          <P>When models have relationships defined (via YAML config), you can query nested resources:</P>
          <CodeBlock lang="http">{`# Get all posts by a specific user
GET /m/abc-xyz/api/users/42/posts

# Get all comments on a specific post
GET /m/abc-xyz/api/posts/7/comments`}</CodeBlock>

          <Divider />

          {/* ─────────────────────────────────────────────────
              FAKE INBOX
              ───────────────────────────────────────────────── */}
          <H2 id="fake-inbox">Fake Inbox</H2>

          <H3 id="inbox-overview">Overview</H3>
          <P>
            MockLane includes a <strong>fake SMTP inbox</strong> that captures all outgoing emails from your application.
            Instead of accidentally emailing real customers during development and testing, all emails land safely in your workspace inbox.
          </P>
          <Callout type="tip">
            This is especially critical when testing with production data — no more &quot;sorry, that was a test email&quot; moments.
          </Callout>

          <H3 id="inbox-setup">SMTP Configuration</H3>
          <P>Each workspace gets unique SMTP credentials. Navigate to your workspace&apos;s <strong>Inbox</strong> tab and click <strong>Show SMTP Credentials</strong> to get:</P>
          <UL>
            <LI><strong>Host</strong> — The SMTP server address (e.g., <InlineCode>localhost</InlineCode> for local dev)</LI>
            <LI><strong>Port</strong> — Default <InlineCode>2525</InlineCode></LI>
            <LI><strong>Username</strong> — Auto-generated per workspace (e.g., <InlineCode>ws_abc123</InlineCode>)</LI>
            <LI><strong>Password</strong> — Random token, can be regenerated anytime</LI>
          </UL>
          <P>Point your application&apos;s email configuration to these credentials. All emails sent through this SMTP server will be captured and displayed in your inbox — regardless of the recipient address.</P>

          <H3 id="inbox-usage">Using the Inbox</H3>
          <P>The inbox provides a full email client experience:</P>
          <UL>
            <LI><strong>Email list</strong> — See sender, subject, timestamp, and unread indicators</LI>
            <LI><strong>HTML Preview</strong> — Renders HTML emails in a sandboxed preview (safe, no script execution)</LI>
            <LI><strong>Plain Text</strong> — View the plain text version of the email</LI>
            <LI><strong>Headers</strong> — Inspect all email headers (Message-ID, Content-Type, etc.)</LI>
            <LI><strong>Attachments</strong> — Download attached files directly from the inbox</LI>
          </UL>

          <H3 id="inbox-frameworks">Framework Examples</H3>
          <P>Here&apos;s how to configure popular frameworks to use MockLane&apos;s SMTP:</P>

          <CodeBlock title="Node.js (Nodemailer)" lang="javascript">{`const nodemailer = require("nodemailer");

const transport = nodemailer.createTransport({
  host: "localhost",
  port: 2525,
  auth: {
    user: "ws_your_workspace_id",
    pass: "your_smtp_password"
  }
});

// All emails will be captured by MockLane
await transport.sendMail({
  from: "app@yourcompany.com",
  to: "customer@example.com",  // Won't reach this person!
  subject: "Order Confirmation",
  html: "<h1>Thank you for your order!</h1>"
});`}</CodeBlock>

          <CodeBlock title="Python (smtplib)" lang="python">{`import smtplib
from email.mime.text import MIMEText

msg = MIMEText("<h1>Hello!</h1>", "html")
msg["Subject"] = "Test Email"
msg["From"] = "app@yourcompany.com"
msg["To"] = "customer@example.com"

with smtplib.SMTP("localhost", 2525) as server:
    server.login("ws_your_workspace_id", "your_smtp_password")
    server.send_message(msg)`}</CodeBlock>

          <CodeBlock title="Django (settings.py)" lang="python">{`EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "localhost"
EMAIL_PORT = 2525
EMAIL_HOST_USER = "ws_your_workspace_id"
EMAIL_HOST_PASSWORD = "your_smtp_password"
EMAIL_USE_TLS = False`}</CodeBlock>

          <CodeBlock title="Rails (config/environments/development.rb)" lang="ruby">{`config.action_mailer.delivery_method = :smtp
config.action_mailer.smtp_settings = {
  address: "localhost",
  port: 2525,
  user_name: "ws_your_workspace_id",
  password: "your_smtp_password",
  authentication: "plain"
}`}</CodeBlock>

          <Divider />

          {/* ─────────────────────────────────────────────────
              ADVANCED
              ───────────────────────────────────────────────── */}
          <H2 id="advanced">Advanced</H2>

          <H3 id="request-logs">Request Logs</H3>
          <P>Every request to your mock endpoints is logged. View from the mock detail page:</P>
          <UL>
            <LI>Timestamp and HTTP method.</LI>
            <LI>Full request headers and body.</LI>
            <LI>The response returned (including which rule or sequence step triggered).</LI>
            <LI>Response time in milliseconds.</LI>
          </UL>

          <H3 id="contract-validation">Contract Validation</H3>
          <P>The Contract Validator checks incoming requests against your endpoint&apos;s expected schema:</P>
          <UL>
            <LI>Required fields are present.</LI>
            <LI>Field types match expectations.</LI>
            <LI>Response format adheres to the defined schema.</LI>
          </UL>

          <H3 id="cors-support">CORS Support</H3>
          <P>
            All mock endpoints respond to CORS preflight (<InlineCode>OPTIONS</InlineCode>) with permissive headers. Call mock APIs directly from browser JavaScript without CORS issues.
          </P>

          <H3 id="rate-limiting">Rate Limiting</H3>
          <P>
            Public endpoints are rate-limited per client IP to keep one noisy
            script from degrading the platform for everyone. Current limits:
          </P>

          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">Endpoint</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">Limit</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">Max body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="px-4 py-2.5"><InlineCode>/m/*</InlineCode> mock serving</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">300 / minute</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">1 MiB</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5"><InlineCode>/h/*</InlineCode> webhook capture</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">60 / minute</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">1 MiB</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">Sign-in link requests</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">5 / hour per address, 20 / hour per IP</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">&mdash;</td>
                </tr>
              </tbody>
            </table>
          </div>

          <P>
            Every response from <InlineCode>/m/*</InlineCode> and <InlineCode>/h/*</InlineCode> carries
            your remaining budget, so you can back off before being blocked rather
            than discovering the limit by hitting it:
          </P>

          <CodeBlock title="Response headers" lang="http">{`X-RateLimit-Limit: 300
X-RateLimit-Remaining: 297
X-RateLimit-Reset: 60`}</CodeBlock>

          <P>
            Exceeding a limit returns <InlineCode>429 Too Many Requests</InlineCode> with a{" "}
            <InlineCode>Retry-After</InlineCode> header giving the seconds until the
            window resets. Requests over the size cap return{" "}
            <InlineCode>413 Payload Too Large</InlineCode>.
          </P>

          <Callout type="tip">
            Preflight <InlineCode>OPTIONS</InlineCode> requests are not counted
            against your budget.
          </Callout>

          {/* ── Footer ── */}
          <div className="mt-20 pt-8 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-sm text-slate-400 dark:text-slate-500">
                MockLane &copy; {new Date().getFullYear()} &middot; Built for developers
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white dark:text-slate-900 bg-slate-900 dark:bg-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
              >
                Go to Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </main>

        {/* ═══ Right Sidebar: "On This Page" ═══ */}
        <aside className="hidden xl:block sticky top-14 h-[calc(100vh-3.5rem)] w-56 flex-shrink-0 overflow-y-auto py-10 pr-4">
          {currentGroup && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                On This Page
              </h4>
              <ul className="space-y-1 border-l border-slate-200 dark:border-slate-800 pl-3">
                {currentGroup.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={cn(
                        "block py-1 text-[12px] transition-colors duration-100",
                        activeSection === s.id
                          ? "text-indigo-600 dark:text-indigo-300 font-medium border-l-2 border-indigo-500 dark:border-indigo-400 -ml-[13px] pl-[11px]"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
