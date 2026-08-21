"use client";

import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import { HTTP_METHOD_COLORS } from "@/lib/utils";
import type { WebhookCapture } from "@/types/webhook";

interface CaptureCardProps {
  capture: WebhookCapture;
}

export function CaptureCard({ capture }: CaptureCardProps) {
  return (
    <Link
      href={`/dashboard/captures/${capture.id}`}
      className="group block bg-white rounded-xl border border-slate-200/60 shadow-sm p-4 hover:shadow-md hover:border-slate-300/80 transition-all duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-bold tracking-wide",
              HTTP_METHOD_COLORS[capture.http_method] || "bg-slate-100 text-slate-600"
            )}
          >
            {capture.http_method}
          </span>
          <span className="text-sm font-mono text-slate-700 group-hover:text-indigo-600 transition-colors">
            {capture.path || "/"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {capture.source_ip && (
            <span className="hidden sm:inline">{capture.source_ip}</span>
          )}
          <span>{formatDate(capture.captured_at)}</span>
          <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
