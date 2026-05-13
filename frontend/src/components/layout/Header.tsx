"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold text-slate-900">
          HookTrap
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-slate-600">{user.email}</span>
              <button
                onClick={logout}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
