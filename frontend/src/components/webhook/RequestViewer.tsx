"use client";

import type { WebhookCapture } from "@/types/webhook";

interface RequestViewerProps {
  capture: WebhookCapture;
  tab: "headers" | "body" | "query";
}

export function RequestViewer({ capture, tab }: RequestViewerProps) {
  if (tab === "body") {
    if (!capture.body) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-base">No body content</p>
        </div>
      );
    }

    let formatted = capture.body;
    try {
      formatted = JSON.stringify(JSON.parse(capture.body), null, 2);
    } catch {}

    return (
      <div className="relative group">
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">JSON</span>
        </div>
        <pre className="bg-slate-950 text-slate-100 p-5 rounded-xl overflow-auto text-base font-mono max-h-96 leading-relaxed selection:bg-indigo-500/30">
          {formatted}
        </pre>
      </div>
    );
  }

  if (tab === "headers") {
    const entries = Object.entries(capture.headers);
    if (entries.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          <p className="text-base">No headers</p>
        </div>
      );
    }

    return (
      <div className="bg-slate-950 rounded-xl p-5 overflow-auto max-h-96">
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-3 text-base font-mono group">
              <span className="text-indigo-400 font-semibold min-w-[200px] shrink-0">{key}</span>
              <span className="text-slate-300 break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "query") {
    const entries = Object.entries(capture.query_params);
    if (entries.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          <p className="text-base">No query parameters</p>
        </div>
      );
    }

    return (
      <div className="bg-slate-950 rounded-xl p-5 overflow-auto max-h-96">
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-3 text-base font-mono">
              <span className="text-indigo-400 font-semibold shrink-0">{key}</span>
              <span className="text-slate-300 break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
