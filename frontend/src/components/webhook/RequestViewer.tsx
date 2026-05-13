"use client";

import type { WebhookCapture } from "@/types/webhook";

interface RequestViewerProps {
  capture: WebhookCapture;
  tab: "headers" | "body" | "query";
}

export function RequestViewer({ capture, tab }: RequestViewerProps) {
  if (tab === "body") {
    if (!capture.body) {
      return <p className="text-slate-500 text-sm">No body</p>;
    }

    let formatted = capture.body;
    try {
      formatted = JSON.stringify(JSON.parse(capture.body), null, 2);
    } catch {}

    return (
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto text-sm font-mono max-h-96">
        {formatted}
      </pre>
    );
  }

  if (tab === "headers") {
    const entries = Object.entries(capture.headers);
    if (entries.length === 0) {
      return <p className="text-slate-500 text-sm">No headers</p>;
    }

    return (
      <div className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2 text-sm font-mono">
            <span className="text-brand-600 font-semibold min-w-[200px]">{key}:</span>
            <span className="text-slate-700 break-all">{value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "query") {
    const entries = Object.entries(capture.query_params);
    if (entries.length === 0) {
      return <p className="text-slate-500 text-sm">No query parameters</p>;
    }

    return (
      <div className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2 text-sm font-mono">
            <span className="text-brand-600 font-semibold">{key}:</span>
            <span className="text-slate-700">{value}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
