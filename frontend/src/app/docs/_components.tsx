"use client";

/* Shared documentation primitives.
 *
 * Extracted verbatim from the former single-page docs so that each split page
 * renders identically. CodeBlock owns copy-to-clipboard state, which is why
 * this module is a client boundary; the page files that import it stay server
 * components, so the prose itself is still server-rendered for crawlers.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

export function CodeBlock({ children, title, lang }: { children: string; title?: string; lang?: string }) {
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

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[13px] px-1.5 py-0.5 rounded-md font-mono border border-slate-200/60 dark:border-slate-700">
      {children}
    </code>
  );
}

export function Callout({ type = "info", children }: { type?: "info" | "warning" | "tip"; children: React.ReactNode }) {
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

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl 2xl:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-16 mb-4 scroll-mt-20 group flex items-center gap-2">
      {children}
      <a href={`#${id}`} className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-opacity" aria-label="Link to this section">#</a>
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-lg 2xl:text-xl font-semibold text-slate-800 dark:text-slate-200 mt-10 mb-3 scroll-mt-20 group flex items-center gap-2">
      {children}
      <a href={`#${id}`} className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-opacity text-base" aria-label="Link to this section">#</a>
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] 2xl:text-base text-slate-600 dark:text-slate-300 leading-7 2xl:leading-8 mb-4">{children}</p>;
}

export function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="my-5 space-y-3 list-none counter-reset-step pl-0">
      {children}
    </ol>
  );
}

export function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5 text-[15px] 2xl:text-base text-slate-600 dark:text-slate-300 leading-7 2xl:leading-8">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-sm font-semibold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="my-4 space-y-2 list-none pl-0">{children}</ul>;
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[15px] 2xl:text-base text-slate-600 dark:text-slate-300 leading-7 2xl:leading-8">
      <span className="text-indigo-400 mt-2.5 flex-shrink-0">
        <svg className="w-1.5 h-1.5" fill="currentColor" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3"/></svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

export function MethodBadge({ method }: { method: string }) {
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

export function Endpoint({ method, path, description }: { method: string; path: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 text-[15px] 2xl:text-base">
      <MethodBadge method={method} />
      <code className="font-mono text-sm 2xl:text-base text-slate-700 dark:text-slate-200">{path}</code>
      {description && <span className="text-slate-400 dark:text-slate-500 text-sm 2xl:text-base ml-auto hidden sm:inline">{description}</span>}
    </div>
  );
}

export function Divider() {
  return <hr className="my-10 border-slate-200/60 dark:border-slate-800" />;
}

/* ──────────────────────────────────────────────────────────────
   GENERATOR REFERENCE DATA
   ────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────
   MAIN PAGE
   ────────────────────────────────────────────────────────────── */

