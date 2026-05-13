"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useCaptureStore } from "@/stores/captureStore";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-1">Endpoints</h3>
          <p className="text-3xl font-bold">-</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-1">Captures Today</h3>
          <p className="text-3xl font-bold">-</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-1">Workspaces</h3>
          <p className="text-3xl font-bold">-</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Link
          href="/dashboard/captures"
          className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-semibold transition"
        >
          View Captures
        </Link>
        <Link
          href="/dashboard/workspace/new"
          className="px-6 py-3 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold transition"
        >
          Create Workspace
        </Link>
      </div>
    </div>
  );
}
