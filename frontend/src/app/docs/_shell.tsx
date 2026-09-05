"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { TOC } from "./_toc";

/**
 * Chrome shared by every documentation page: site header, mobile nav, search,
 * the left group nav and the right "On This Page" rail.
 *
 * The active group now comes from the URL rather than from whichever heading
 * the scroll observer last saw, so the correct group is highlighted on first
 * paint instead of after the first scroll. The observer still runs, but only
 * to track which section within the current page is in view.
 */
export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentGroup =
    TOC.find((g) => g.href === pathname) ??
    TOC.find((g) => pathname.startsWith(g.href) && g.href !== "/docs") ??
    TOC[0];

  useEffect(() => {
    const headings = document.querySelectorAll("h2[id], h3[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [pathname]);

  // Close the mobile drawer on navigation, otherwise it stays open over the
  // page the reader just chose.
  useEffect(() => setMobileNavOpen(false), [pathname]);

  const allSections = TOC.flatMap((g) =>
    g.sections.map((s) => ({ ...s, group: g.title, href: `${g.href}#${s.id}` })),
  );
  const searchResults = searchQuery.trim()
    ? allSections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.group.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const groupNav = (
    <nav className="space-y-6">
      {TOC.map((group) => (
        <div key={group.id}>
          <Link
            href={group.href}
            className={cn(
              "block text-xs font-bold uppercase tracking-widest mb-2 transition-colors",
              group.href === currentGroup.href
                ? "text-indigo-600 dark:text-indigo-300"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            {group.title}
          </Link>
          <ul className="space-y-1 border-l border-slate-200 dark:border-slate-800 pl-3">
            {group.sections.map((s) => (
              <li key={s.id}>
                <Link
                  href={`${group.href}#${s.id}`}
                  className={cn(
                    "block py-1 text-[13px] transition-colors duration-100",
                    group.href === currentGroup.href && activeSection === s.id
                      ? "text-indigo-600 dark:text-indigo-300 font-medium"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicHeader />

      {/* Docs toolbar: mobile menu, breadcrumb, search */}
      <div className="sticky top-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400"
            aria-label="Toggle documentation navigation"
            aria-expanded={mobileNavOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-sm">
            <Link href="/docs" className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
              Docs
            </Link>
            {currentGroup.href !== "/docs" && (
              <>
                <span className="text-slate-300 dark:text-slate-700">/</span>
                <span className="text-slate-700 dark:text-slate-200 font-medium">{currentGroup.title}</span>
              </>
            )}
          </nav>

          <div className="relative ml-auto w-full max-w-xs">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs…"
              aria-label="Search documentation"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            {searchResults.length > 0 && (
              <ul className="absolute left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1 z-50">
                {searchResults.map((s) => (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      onClick={() => setSearchQuery("")}
                      className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {s.title}
                      <span className="ml-2 text-xs text-slate-400">{s.group}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {mobileNavOpen && (
          <div className="lg:hidden border-t border-slate-100 dark:border-slate-800 px-6 py-6 max-h-[70vh] overflow-y-auto">
            {groupNav}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 flex gap-10">
        {/* Left: all groups */}
        <aside className="hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] w-60 flex-shrink-0 overflow-y-auto py-10 pr-2">
          {groupNav}
        </aside>

        <main className="min-w-0 flex-1 py-10 max-w-3xl">
          {children}

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

        {/* Right: sections within this page */}
        <aside className="hidden xl:block sticky top-14 h-[calc(100vh-3.5rem)] w-56 flex-shrink-0 overflow-y-auto py-10 pr-4">
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
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200",
                  )}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
