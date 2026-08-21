"use client";

import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import type { WebhookCapture } from "@/types/webhook";
import { HTTP_METHOD_COLORS } from "@/lib/utils";

interface CaptureListProps {
  captures: WebhookCapture[];
}

export function CaptureList({ captures }: CaptureListProps) {
  if (captures.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200/60 shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium">No captures yet</p>
        <p className="text-base text-slate-400 mt-1">Webhook requests will appear here once received.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider">Method</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider">Path</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Content Type</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Size</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider">Captured</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {captures.map((capture) => (
            <tr
              key={capture.id}
              className="group hover:bg-slate-50/50 transition-colors"
            >
              <td className="px-5 py-3.5">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-md text-sm font-bold tracking-wide",
                    HTTP_METHOD_COLORS[capture.http_method] || "bg-slate-100 text-slate-600"
                  )}
                >
                  {capture.http_method}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <Link
                  href={`/dashboard/captures/${capture.id}`}
                  className="text-base font-mono text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  {capture.path || "/"}
                </Link>
              </td>
              <td className="px-5 py-3.5 text-base text-slate-400 hidden md:table-cell">
                {capture.content_type ? (
                  <span className="bg-slate-50 px-2 py-0.5 rounded text-sm font-mono">{capture.content_type}</span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-base text-slate-400 hidden sm:table-cell">
                <span className="tabular-nums">{capture.body_size} B</span>
              </td>
              <td className="px-5 py-3.5 text-base text-slate-400">
                {formatDate(capture.captured_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
