"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { AdminDashboardStats } from "@/types/admin";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/v1/admin/dashboard")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-20 text-slate-400">Failed to load dashboard data.</div>;
  }

  const maxSignup = Math.max(...stats.signups_last_7_days.map((d) => d.count), 1);

  const PLAN_COLORS: Record<string, string> = {
    free: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
    pro: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
    team: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300",
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-base text-slate-500 dark:text-slate-400 mt-2">Platform overview and key metrics.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_users}</p>
        </div>

        {/* Active Users */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active (30d)</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.active_users_30d}</p>
        </div>

        {/* Blocked Users */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Blocked</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.blocked_users}</p>
        </div>

        {/* Plan Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Plans</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.plan_breakdown).map(([plan, count]) => (
              <span
                key={plan}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PLAN_COLORS[plan] || PLAN_COLORS.free}`}
              >
                {plan.charAt(0).toUpperCase() + plan.slice(1)}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column layout: Signups chart + Recent signups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signups last 7 days - bar chart */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Signups (Last 7 Days)</h2>
          <div className="flex items-end gap-2 h-40">
            {stats.signups_last_7_days.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{day.count}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-violet-500 transition-all"
                  style={{ height: `${Math.max((day.count / maxSignup) * 100, 4)}%` }}
                />
                <span className="text-xs text-slate-400">
                  {new Date(day.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent signups */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Signups</h2>
            <Link href="/admin/users" className="text-sm text-indigo-500 hover:text-indigo-600 font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recent_signups.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-semibold">
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{u.email}</p>
                    <p className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[u.plan] || PLAN_COLORS.free}`}>
                  {u.plan}
                </span>
              </div>
            ))}
            {stats.recent_signups.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No users yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
