"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ContractValidation {
  total_requests: number;
  valid_requests: number;
  invalid_requests: number;
  compliance_percentage: number;
  recent_errors: Array<{
    path: string;
    method: string;
    error: string;
    received_at: string;
  }>;
}

interface ContractValidatorProps {
  workspaceId: string;
  mockId: string;
}

export function ContractValidator({ workspaceId, mockId }: ContractValidatorProps) {
  const [validation, setValidation] = useState<ContractValidation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/v1/workspaces/${workspaceId}/mocks/${mockId}/contract-validation`)
      .then(setValidation)
      .catch(() => {
        // Contract validation endpoint may not exist yet
        setValidation(null);
      })
      .finally(() => setLoading(false));
  }, [workspaceId, mockId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-spin text-indigo-400">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
          <path d="M8 2a6 6 0 015.9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Loading contract validation...
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-400 shrink-0 mt-0.5">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 1.5L2 5v4c0 4.42 2.99 8.55 7 9.5 4.01-.95 7-5.08 7-9.5V5L9 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 8v2M9 12h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Contract Validation</h3>
            <p className="text-sm text-slate-400">
              No OpenAPI spec linked to this mock endpoint. Import an OpenAPI spec to enable contract validation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const complianceColor =
    validation.compliance_percentage >= 90
      ? "text-emerald-600"
      : validation.compliance_percentage >= 70
        ? "text-amber-600"
        : "text-red-600";

  const complianceBg =
    validation.compliance_percentage >= 90
      ? "bg-emerald-500"
      : validation.compliance_percentage >= 70
        ? "bg-amber-500"
        : "bg-red-500";

  const complianceTrack =
    validation.compliance_percentage >= 90
      ? "bg-emerald-100"
      : validation.compliance_percentage >= 70
        ? "bg-amber-100"
        : "bg-red-100";

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500">
          <path d="M9 1.5L2 5v4c0 4.42 2.99 8.55 7 9.5 4.01-.95 7-5.08 7-9.5V5L9 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M6.5 9l2 2 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h3 className="text-sm font-semibold text-slate-800">Contract Validation</h3>
      </div>

      {/* Compliance meter */}
      <div className="flex items-center gap-6 mb-5">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Compliance</span>
            <span className={`text-sm font-bold ${complianceColor}`}>
              {validation.compliance_percentage.toFixed(1)}%
            </span>
          </div>
          <div className={cn("w-full rounded-full h-2", complianceTrack)}>
            <div
              className={cn("h-2 rounded-full transition-all duration-500 ease-out", complianceBg)}
              style={{ width: `${validation.compliance_percentage}%` }}
            />
          </div>
        </div>
        <div className="flex gap-5 text-xs">
          <div className="text-center">
            <span className="block text-lg font-bold text-slate-700 tabular-nums">
              {validation.total_requests}
            </span>
            <span className="text-slate-400 font-medium">Total</span>
          </div>
          <div className="text-center">
            <span className="block text-lg font-bold text-emerald-600 tabular-nums">
              {validation.valid_requests}
            </span>
            <span className="text-emerald-500/70 font-medium">Valid</span>
          </div>
          <div className="text-center">
            <span className="block text-lg font-bold text-red-600 tabular-nums">
              {validation.invalid_requests}
            </span>
            <span className="text-red-500/70 font-medium">Invalid</span>
          </div>
        </div>
      </div>

      {/* Recent errors */}
      {validation.recent_errors.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Recent Errors</h4>
          <div className="space-y-2 max-h-48 overflow-auto">
            {validation.recent_errors.map((err, i) => (
              <div
                key={i}
                className="bg-red-50/70 border border-red-100 rounded-lg px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-400">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4.5 4.5l3 3M7.5 4.5l-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <span className="font-semibold text-red-700">
                      {err.method} {err.path}
                    </span>
                  </span>
                  <span className="text-red-400 text-[10px] font-mono ml-auto">
                    {new Date(err.received_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-red-600 pl-4">{err.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
