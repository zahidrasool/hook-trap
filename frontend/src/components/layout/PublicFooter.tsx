import Link from "next/link";

/**
 * Theme-aware footer for public pages (landing, why, pricing, faq, docs, login).
 */
export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-slate-200 dark:border-white/[0.06] py-14 bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5 text-base text-slate-500">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500">
              <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 4L4 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M17 4L20 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M12 5V8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M12 11V14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M12 17V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            Mock<span className="font-bold text-slate-700 dark:text-slate-400">Lane</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            <Link href="/#features" className="text-base text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">Features</Link>
            <Link href="/why" className="text-base text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">Why MockLane</Link>
            <Link href="/pricing" className="text-base text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">Pricing</Link>
            <Link href="/faq" className="text-base text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">FAQ</Link>
            <Link href="/docs" className="text-base text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">Docs</Link>
          </nav>
          <p className="text-base text-slate-500 dark:text-slate-600">
            &copy; {new Date().getFullYear()} MockLane. Built for developers.
          </p>
        </div>
      </div>
    </footer>
  );
}
