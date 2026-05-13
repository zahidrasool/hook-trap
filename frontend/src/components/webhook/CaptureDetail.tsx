"use client";

import { useState } from "react";
import { formatDate, cn } from "@/lib/utils";
import { HTTP_METHOD_COLORS } from "@/lib/utils";
import type { WebhookCapture } from "@/types/webhook";
import { RequestViewer } from "./RequestViewer";

interface CaptureDetailProps {
  capture: WebhookCapture;
}

export function CaptureDetail({ capture }: CaptureDetailProps) {
  const [activeTab, setActiveTab] = useState<"headers" | "body" | "query">("body");

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={cn(
              "px-3 py-1 rounded text-sm font-semibold",
              HTTP_METHOD_COLORS[capture.http_method] || "bg-gray-100"
            )}
          >
            {capture.http_method}
          </span>
          <span className="text-lg font-mono text-slate-700">{capture.path || "/"}</span>
        </div>
        <p className="text-sm text-slate-500">
          Captured {formatDate(capture.captured_at)} from {capture.source_ip || "unknown"}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex border-b border-slate-200">
          {(["body", "headers", "query"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-3 text-sm font-medium capitalize transition",
                activeTab === tab
                  ? "border-b-2 border-brand-500 text-brand-600"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4">
          <RequestViewer capture={capture} tab={activeTab} />
        </div>
      </div>
    </div>
  );
}
