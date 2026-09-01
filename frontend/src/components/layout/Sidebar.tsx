"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { Workspace } from "@/types/workspace";

const WORKSPACE_COLORS = [
  "bg-indigo-400",
  "bg-violet-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-teal-400",
  "bg-pink-400",
];

function getWorkspaceColor(index: number) {
  return WORKSPACE_COLORS[index % WORKSPACE_COLORS.length];
}

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    api.get("/api/v1/workspaces")
      .then((data) => setWorkspaces(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  }, []);

  return (
    <aside className="w-[270px] bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 h-full relative">
      {/* Mobile close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors lg:hidden"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation: MAIN */}
      <div className="px-3 pt-7 pb-3">
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold px-3.5 mb-3">
          Main
        </p>
        <nav className="space-y-1">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            onClick={() => onClose?.()}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors relative",
              pathname === "/dashboard"
                ? "bg-indigo-50 text-slate-900 dark:bg-white/10 dark:text-white font-medium"
                : "hover:bg-slate-100 text-slate-600 dark:hover:bg-white/10 dark:text-slate-300"
            )}
          >
            {pathname === "/dashboard" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-indigo-400" />
            )}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Dashboard
          </Link>

          {/* Captures */}
          <Link
            href="/dashboard/captures"
            onClick={() => onClose?.()}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors relative",
              pathname === "/dashboard/captures"
                ? "bg-indigo-50 text-slate-900 dark:bg-white/10 dark:text-white font-medium"
                : "hover:bg-slate-100 text-slate-600 dark:hover:bg-white/10 dark:text-slate-300"
            )}
          >
            {pathname === "/dashboard/captures" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-indigo-400" />
            )}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
            </svg>
            Captures
          </Link>

          {/* Sandboxes */}
          <Link
            href="/dashboard/sandboxes"
            onClick={() => onClose?.()}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors relative",
              pathname.startsWith("/dashboard/sandboxes")
                ? "bg-indigo-50 text-slate-900 dark:bg-white/10 dark:text-white font-medium"
                : "hover:bg-slate-100 text-slate-600 dark:hover:bg-white/10 dark:text-slate-300"
            )}
          >
            {pathname.startsWith("/dashboard/sandboxes") && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-indigo-400" />
            )}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Sandboxes
          </Link>

          {/* Settings */}
          <Link
            href="/dashboard/settings"
            onClick={() => onClose?.()}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors relative",
              pathname === "/dashboard/settings"
                ? "bg-indigo-50 text-slate-900 dark:bg-white/10 dark:text-white font-medium"
                : "hover:bg-slate-100 text-slate-600 dark:hover:bg-white/10 dark:text-slate-300"
            )}
          >
            {pathname === "/dashboard/settings" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-indigo-400" />
            )}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>

          {/* Documentation */}
          <Link
            href="/docs"
            target="_blank"
            onClick={() => onClose?.()}
            className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors relative hover:bg-slate-100 text-slate-600 dark:hover:bg-white/10 dark:text-slate-300"
          >
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Docs
            <svg className="w-3 h-3 ml-auto text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </Link>

          {/* Admin Panel — admins only */}
          {user?.is_admin && (
            <Link
              href="/admin"
              onClick={() => onClose?.()}
              className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors relative hover:bg-slate-100 text-slate-600 dark:hover:bg-white/10 dark:text-slate-300"
            >
              <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              Admin Panel
              <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                Admin
              </span>
            </Link>
          )}
        </nav>
      </div>

      {/* Navigation: WORKSPACES */}
      <div className="px-3 pt-7 pb-3 flex-1 min-h-0 overflow-y-auto">
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold px-3.5 mb-3">
          Workspaces
        </p>
        <nav className="space-y-1">
          {workspaces.map((ws, index) => {
            const wsHref = `/dashboard/workspace/${ws.short_id}`;
            const isActive = pathname.startsWith(wsHref);
            return (
              <Link
                key={ws.id}
                href={wsHref}
                onClick={() => onClose?.()}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors relative",
                  isActive
                    ? "bg-indigo-50 text-slate-900 dark:bg-white/10 dark:text-white font-medium"
                    : "hover:bg-slate-100 text-slate-600 dark:hover:bg-white/10 dark:text-slate-300"
                )}
                title={ws.name}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-indigo-400" />
                )}
                <span
                  className={cn(
                    "w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0",
                    getWorkspaceColor(index)
                  )}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{ws.name}</span>
              </Link>
            );
          })}
          {workspaces.length === 0 && (
            <p className="px-3.5 py-2.5 text-sm text-slate-500">No workspaces yet</p>
          )}
        </nav>

        {/* New Workspace button */}
        <Link
          href="/dashboard/workspace/new"
          onClick={() => onClose?.()}
          className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 mt-2 text-[15px] text-slate-500 hover:text-slate-800 border border-dashed border-slate-300 hover:border-slate-400 dark:hover:text-slate-300 dark:border-slate-700 dark:hover:border-slate-500 transition-colors"
        >
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Workspace
        </Link>
      </div>
    </aside>
  );
}
