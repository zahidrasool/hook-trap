"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { AdminUserDetail } from "@/types/admin";

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api
      .get(`/api/v1/admin/users/${userId}`)
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const updateUser = async (updates: Partial<AdminUserDetail>) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await api.patch(`/api/v1/admin/users/${userId}`, updates);
      setUser(updated);
      showMessage("success", "User updated successfully.");
    } catch {
      showMessage("error", "Failed to update user.");
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = (plan: string) => {
    updateUser({ plan } as Partial<AdminUserDetail>);
  };

  const handleAdminToggle = () => {
    if (!user) return;
    updateUser({ is_admin: !user.is_admin } as Partial<AdminUserDetail>);
  };

  const handleBlockToggle = () => {
    if (!user) return;
    if (!user.is_blocked) {
      // Require confirmation to block
      if (!confirmBlock) {
        setConfirmBlock(true);
        return;
      }
    }
    setConfirmBlock(false);
    updateUser({ is_blocked: !user.is_blocked } as Partial<AdminUserDetail>);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading user...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link href="/admin/users" className="text-sm text-indigo-500 hover:text-indigo-600 font-medium mb-4 inline-block">
          &larr; Back to Users
        </Link>
        <div className="text-center py-20 text-slate-400">User not found.</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 font-medium mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Users
      </Link>

      {/* Toast message */}
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* User info card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{user.email}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">ID: {user.id}</span>
              {user.email_verified ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  Verified
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  Unverified
                </span>
              )}
              {user.is_blocked && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                  Blocked
                </span>
              )}
              {user.is_admin && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  Admin
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Joined {new Date(user.created_at).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Resource counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Workspaces</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{user.workspace_count}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Endpoints</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{user.endpoint_count}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Sandboxes</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{user.sandbox_count}</p>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
        {/* Plan */}
        <div className="p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Plan</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Change the user&apos;s subscription plan.</p>
          </div>
          <select
            value={user.plan}
            onChange={(e) => handlePlanChange(e.target.value)}
            disabled={saving}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="team">Team</option>
          </select>
        </div>

        {/* Admin toggle */}
        <div className="p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Admin Access</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Grant or revoke admin privileges.</p>
          </div>
          <button
            onClick={handleAdminToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 ${
              user.is_admin ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                user.is_admin ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Block toggle */}
        <div className="p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {user.is_blocked ? "Unblock User" : "Block User"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {user.is_blocked
                ? "Restore access for this user."
                : "Prevent this user from accessing the platform."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {confirmBlock && (
              <span className="text-xs text-red-500 dark:text-red-400 font-medium">Are you sure?</span>
            )}
            <button
              onClick={handleBlockToggle}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                user.is_blocked
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                  : confirmBlock
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
              }`}
            >
              {saving ? "..." : user.is_blocked ? "Unblock" : confirmBlock ? "Confirm Block" : "Block"}
            </button>
            {confirmBlock && (
              <button
                onClick={() => setConfirmBlock(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Stripe Customer ID */}
        {user.stripe_customer_id && (
          <div className="p-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Stripe Customer</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Linked Stripe customer identifier.</p>
            </div>
            <code className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300 font-mono">
              {user.stripe_customer_id}
            </code>
          </div>
        )}

        {/* Timestamps */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Timestamps</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Created: </span>
              <span className="text-slate-900 dark:text-white">
                {new Date(user.created_at).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Updated: </span>
              <span className="text-slate-900 dark:text-white">
                {new Date(user.updated_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
