"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();

  const initial = user?.email?.charAt(0)?.toUpperCase() || "?";

  return (
    <header className="h-16 bg-white border-b border-slate-200/60 shadow-sm flex items-center justify-between px-5 sm:px-8">
      <div className="flex items-center gap-2.5">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors lg:hidden"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            HookTrap
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Docs link — always visible */}
        <Link
          href="/docs"
          target="_blank"
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <span className="hidden sm:inline">Docs</span>
        </Link>

        {user && (
          <>
            <span className="text-base text-slate-600 hidden sm:inline">
              {user.email}
            </span>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-semibold select-none">
              {initial}
            </div>
            <button
              onClick={logout}
              className="text-base text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
