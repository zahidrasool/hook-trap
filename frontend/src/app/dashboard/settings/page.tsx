"use client";

import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-base text-slate-500 mt-2">
          Manage your account preferences and configuration.
        </p>
      </div>

      {/* Profile section */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
          <p className="text-base text-slate-500 mt-1">
            Your personal account information.
          </p>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-base font-medium text-slate-700 mb-1.5">
              Email address
            </label>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {user?.email?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <span className="text-base text-slate-600">
                {user?.email || "Not signed in"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences section */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Preferences</h2>
          <p className="text-base text-slate-500 mt-1">
            Configure how HookTrap works for you.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-base font-medium text-slate-700">
                Email notifications
              </p>
              <p className="text-base text-slate-500">
                Receive email alerts for new captures.
              </p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
              Coming soon
            </span>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-base font-medium text-slate-700">
                Webhook auto-retry
              </p>
              <p className="text-base text-slate-500">
                Automatically retry failed webhook deliveries.
              </p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
              Coming soon
            </span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-200 mb-6">
        <div className="px-6 py-4 border-b border-red-100">
          <h2 className="text-xl font-semibold text-red-600">Danger Zone</h2>
          <p className="text-base text-slate-500 mt-1">
            Irreversible account actions.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-slate-700">
                Delete account
              </p>
              <p className="text-base text-slate-500">
                Permanently delete your account and all data.
              </p>
            </div>
            <button
              disabled
              className="px-5 py-2.5 text-base font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
