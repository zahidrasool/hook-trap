"use client";

import { Fragment, useState } from "react";
import { cn, HTTP_METHOD_COLORS, formatDate } from "@/lib/utils";
import type { MockRequestLog as MockRequestLogType } from "@/types/mock";

interface MockRequestLogProps {
  logs: MockRequestLogType[];
  loading?: boolean;
}

export function MockRequestLog({ logs, loading }: MockRequestLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-spin mb-3 text-indigo-400">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
          <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span className="text-sm">Loading request logs...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-lg font-medium text-slate-600 mb-1">No requests yet</p>
        <p className="text-base text-slate-400">Send a request to your mock endpoint to see logs here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/60 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200/60">
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider">Time</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider">Method</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider">Path</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider">Matched</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500 uppercase tracking-wider">Latency</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, logIndex) => {
            const isExpanded = expandedId === log.id;
            const methodColor =
              HTTP_METHOD_COLORS[log.method.toUpperCase()] || HTTP_METHOD_COLORS.GET;

            return (
              <Fragment key={log.id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className={cn(
                    "cursor-pointer transition-colors duration-150 group",
                    logIndex % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                    isExpanded && "bg-indigo-50/30",
                    "hover:bg-indigo-50/40"
                  )}
                >
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap font-mono">
                    {formatDate(log.received_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-md text-sm font-bold uppercase tracking-wide", methodColor)}>
                      {log.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-600 max-w-[200px] truncate">
                    {log.path}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-sm px-2 py-0.5 rounded-md font-medium", {
                      "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200/80": !log.matched_rule_id && !log.matched_sequence_id,
                      "bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200/80": log.matched_rule_id,
                      "bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-200/80": log.matched_sequence_id,
                    })}>
                      {log.matched_rule_id
                        ? "Rule"
                        : log.matched_sequence_id
                          ? "Sequence"
                          : "Default"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn("text-sm font-bold px-2 py-0.5 rounded-md ring-1 ring-inset", {
                        "bg-emerald-50 text-emerald-700 ring-emerald-600/20": log.response_status && log.response_status < 300,
                        "bg-amber-50 text-amber-700 ring-amber-600/20":
                          log.response_status &&
                          log.response_status >= 300 &&
                          log.response_status < 400,
                        "bg-red-50 text-red-700 ring-red-600/20": log.response_status && log.response_status >= 400,
                        "bg-slate-50 text-slate-400 ring-slate-200": !log.response_status,
                      })}
                    >
                      {log.response_status || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                    {log.response_delay_ms != null ? `${log.response_delay_ms}ms` : "-"}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="bg-slate-50/70 px-6 py-5 border-t border-b border-slate-200/60">
                      <div className="grid grid-cols-2 gap-5 text-base">
                        <div>
                          <h4 className="font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-400">
                              <path d="M5 3l5 4-5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Query Parameters
                          </h4>
                          {Object.keys(log.query_params).length > 0 ? (
                            <pre className="bg-white p-3 rounded-lg border border-slate-200/60 overflow-auto max-h-32 font-mono text-slate-600">
                              {JSON.stringify(log.query_params, null, 2)}
                            </pre>
                          ) : (
                            <p className="text-slate-400 italic pl-1">None</p>
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-400">
                              <path d="M3 4h8M3 7h6M3 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            </svg>
                            Headers
                          </h4>
                          <pre className="bg-white p-3 rounded-lg border border-slate-200/60 overflow-auto max-h-32 font-mono text-slate-600">
                            {JSON.stringify(log.headers, null, 2)}
                          </pre>
                        </div>
                        {log.body && (
                          <div className="col-span-2">
                            <h4 className="font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-400">
                                <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                                <path d="M5 5h4M5 7h3M5 9h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                              </svg>
                              Request Body
                            </h4>
                            <pre className="bg-white p-3 rounded-lg border border-slate-200/60 overflow-auto max-h-48 font-mono text-slate-600">
                              {log.body}
                            </pre>
                          </div>
                        )}
                        <div className="col-span-2 flex gap-4 text-slate-500">
                          {log.contract_valid !== null && (
                            <span className="flex items-center gap-1.5">
                              Contract:{" "}
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-sm font-medium ring-1 ring-inset",
                                  log.contract_valid
                                    ? "bg-emerald-50 text-emerald-600 ring-emerald-200/80"
                                    : "bg-red-50 text-red-600 ring-red-200/80"
                                )}
                              >
                                {log.contract_valid ? "Valid" : "Invalid"}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
