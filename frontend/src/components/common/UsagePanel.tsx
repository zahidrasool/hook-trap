"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { UsageSummary, UsageMeter } from "@/types/admin";

const LABELS: Record<string, { label: string; hint: string }> = {
  mock_requests: { label: "Mock API requests", hint: "Calls served from your mock endpoints" },
  webhook_captures: { label: "Webhooks captured", hint: "Requests received on your capture URLs" },
  emails: { label: "Emails received", hint: "Across workspace inboxes and sandboxes" },
  workspaces: { label: "Workspaces", hint: "" },
  sandboxes: { label: "Sandboxes", hint: "" },
};

/** Green until it matters, amber as a warning, red once the ceiling is reached. */
function barColor(m: UsageMeter) {
  if (m.exceeded) return "bg-red-500";
  if (m.percent >= 80) return "bg-amber-500";
  return "bg-indigo-500";
}

function Meter({ id, meter }: { id: string; meter: UsageMeter }) {
  const meta = LABELS[id] ?? { label: id, hint: "" };
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {meta.label}
        </span>
        <span
          className={`text-sm tabular-nums ${
            meter.exceeded
              ? "text-red-600 dark:text-red-400 font-semibold"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {meter.used.toLocaleString()}{" "}
          <span className="text-slate-400">/ {meter.limit.toLocaleString()}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${barColor(meter)}`}
          style={{ width: `${Math.max(meter.percent, meter.used > 0 ? 2 : 0)}%` }}
        />
      </div>
      {meta.hint && (
        <p className="mt-1 text-xs text-slate-400">{meta.hint}</p>
      )}
    </div>
  );
}

export function UsagePanel() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/v1/billing/usage")
      .then(setUsage)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (!usage) return null;

  const resetDate = new Date(usage.period_end).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const anyExceeded = Object.values(usage.quotas).some((m) => m.exceeded);

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Usage this month
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Resets {resetDate}
          </p>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          {usage.plan_name}
        </span>
      </div>

      <div className="space-y-5 px-6 py-5">
        {Object.entries(usage.quotas).map(([id, meter]) => (
          <Meter key={id} id={id} meter={meter} />
        ))}

        <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Plan limits
          </p>
          <div className="space-y-5">
            {Object.entries(usage.limits).map(([id, meter]) => (
              <Meter key={id} id={id} meter={meter} />
            ))}
          </div>
        </div>

        {(anyExceeded || usage.plan === "free") && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {anyExceeded
                ? "You've reached a limit on this plan."
                : "Need more headroom?"}
            </p>
            <Link
              href="/pricing"
              className="whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              View plans
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
