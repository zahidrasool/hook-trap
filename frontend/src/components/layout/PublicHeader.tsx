"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/why", label: "Why MockLane" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/docs", label: "Docs" },
];

/**
 * Theme-aware top navigation shared by all public pages
 * (landing, why, pricing, faq, docs, login).
 */
export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const onLogin = pathname === "/auth/login";

  const linkClass = (href: string) =>
    pathname === href
      ? "text-slate-900 dark:text-white"
      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white";

  return (
    <header className="relative z-[60] border-b border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/20">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M17 4L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 11V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 17V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Mock<span className="bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">Lane</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-4 py-2 text-base font-medium transition-colors ${linkClass(l.href)}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {!onLogin && (
            <>
              <Link
                href="/auth/login"
                className="hidden sm:inline-flex rounded-lg px-4 py-2.5 text-base font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/auth/login"
                className="hidden sm:inline-flex rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-base font-medium text-white shadow-sm transition-all hover:from-indigo-600 hover:to-violet-600"
              >
                Get Started
              </Link>
            </>
          )}
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            {open ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden border-t border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-base font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${linkClass(l.href)}`}
              >
                {l.label}
              </Link>
            ))}
            {!onLogin && (
              <div className="mt-2 pt-3 border-t border-slate-200/70 dark:border-white/10 flex flex-col gap-2 sm:hidden">
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-center text-base font-medium text-white shadow-sm transition-all hover:from-indigo-600 hover:to-violet-600"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
