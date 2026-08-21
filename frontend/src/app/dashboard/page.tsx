"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { Workspace } from "@/types/workspace";

export default function DashboardPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  useEffect(() => {
    api.get("/api/v1/workspaces")
      .then((data) => setWorkspaces(Array.isArray(data) ? data : data.data || []))
      .catch(() => {})
      .finally(() => setLoadingWorkspaces(false));
  }, []);

  const ROLE_BADGE_COLORS: Record<string, string> = {
    owner: "bg-violet-100 text-violet-700",
    admin: "bg-indigo-100 text-indigo-700",
    editor: "bg-emerald-100 text-emerald-700",
    viewer: "bg-slate-100 text-slate-600",
  };

  const firstName = user?.email?.split("@")[0] || "there";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome section */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome back, {firstName}
        </h1>
        <p className="text-base text-slate-500 mt-2">
          Here&apos;s an overview of your webhook workspace.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-1.239a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.49 8.614" />
            </svg>
          </div>
          <div>
            <p className="text-base font-medium text-slate-500">Endpoints</p>
            <p className="text-3xl font-bold text-slate-900 mt-0.5">-</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-medium text-slate-500">Captures Today</p>
            <p className="text-3xl font-bold text-slate-900 mt-0.5">-</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-medium text-slate-500">Workspaces</p>
            <p className="text-3xl font-bold text-slate-900 mt-0.5">
              {loadingWorkspaces ? "-" : workspaces.length}
            </p>
          </div>
        </div>
      </div>

      {/* Workspaces section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900">Your Workspaces</h2>
        <p className="text-base text-slate-500 mt-1">
          Manage your webhook endpoints and mock APIs.
        </p>
      </div>

      {loadingWorkspaces ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading workspaces...</span>
          </div>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No workspaces yet</h3>
          <p className="text-base text-slate-500 mb-6">
            Create your first workspace to start building mock APIs.
          </p>
          <Link
            href="/dashboard/workspace/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-lg text-base font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Workspace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/dashboard/workspace/${ws.short_id}`}
              className="group bg-white rounded-xl border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                  {ws.name}
                </h3>
                {ws.role && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                      ROLE_BADGE_COLORS[ws.role] || ROLE_BADGE_COLORS.viewer
                    }`}
                  >
                    {ws.role}
                  </span>
                )}
              </div>
              {ws.description && (
                <p className="text-base text-slate-500 mb-4 line-clamp-2 flex-1">
                  {ws.description}
                </p>
              )}
              {!ws.description && <div className="flex-1" />}
              <div className="flex gap-4 text-sm text-slate-400 pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                  {ws.mock_count} mock{ws.mock_count !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  {ws.member_count} member{ws.member_count !== 1 ? "s" : ""}
                </span>
              </div>
            </Link>
          ))}

          {/* Create workspace card */}
          <Link
            href="/dashboard/workspace/new"
            className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all duration-200 p-6 min-h-[180px]"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center mb-3 transition-colors">
              <svg className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-base font-medium text-slate-500 group-hover:text-indigo-600 transition-colors">
              Create Workspace
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
