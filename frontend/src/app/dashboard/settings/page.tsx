"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

const planDetails: Record<string, { name: string; badge: string }> = {
  free: { name: "Free", badge: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" },
  pro: { name: "Pro", badge: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300" },
  team: { name: "Team", badge: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300" },
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [billingStatus, setBillingStatus] = useState<{
    plan: string;
    has_billing: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/api/v1/billing/status").then(setBillingStatus).catch(() => {});
  }, []);

  const handleUpgrade = async (priceId: string) => {
    setLoading(true);
    try {
      const { url } = await api.post("/api/v1/billing/checkout", {
        price_id: priceId,
      });
      window.location.href = url;
    } catch (e) {
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const { url } = await api.post("/api/v1/billing/portal", {});
      window.location.href = url;
    } catch (e) {
      alert("Failed to open billing portal.");
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = billingStatus?.plan || "free";
  const planInfo = planDetails[currentPlan] || planDetails.free;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-base text-slate-500 dark:text-slate-400 mt-2">
          Manage your account preferences and configuration.
        </p>
      </div>

      {/* Profile section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Profile</h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
            Your personal account information.
          </p>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email address
            </label>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {user?.email?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <span className="text-base text-slate-600 dark:text-slate-300">
                {user?.email || "Not signed in"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Billing section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Billing</h2>
              <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
                Manage your subscription and payment method.
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${planInfo.badge}`}>
              {planInfo.name}
            </span>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          {currentPlan === "free" ? (
            <div>
              <p className="text-base text-slate-600 dark:text-slate-300 mb-4">
                You&apos;re on the Free plan. Upgrade to unlock more workspaces, endpoints, and features.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleUpgrade("price_pro")}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-semibold shadow-sm hover:shadow-md hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Upgrade to Pro — $12/mo"}
                </button>
                <button
                  onClick={() => handleUpgrade("price_team")}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-base font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Team — $39/mo
                </button>
              </div>
              <p className="text-sm text-slate-400 mt-3">
                You&apos;ll be redirected to Stripe for secure checkout.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-base text-slate-600 dark:text-slate-300 mb-4">
                You&apos;re on the <strong>{planInfo.name}</strong> plan.
              </p>
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-base font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : "Manage Billing"}
              </button>
              <p className="text-sm text-slate-400 mt-3">
                Update payment method, view invoices, or cancel your subscription.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Preferences section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Preferences</h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
            Configure how MockLane works for you.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                Email notifications
              </p>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Receive email alerts for new captures.
              </p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
              Coming soon
            </span>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800" />
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                Webhook auto-retry
              </p>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Automatically retry failed webhook deliveries.
              </p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
              Coming soon
            </span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/50 mb-6">
        <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
            Irreversible account actions.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                Delete account
              </p>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Permanently delete your account and all data.
              </p>
            </div>
            <button
              disabled
              className="px-5 py-2.5 text-base font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
