"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, cn, copyToClipboard } from "@/lib/utils";
import { HTTP_METHOD_COLORS } from "@/lib/utils";
import type { WebhookCapture } from "@/types/webhook";
import { RequestViewer } from "./RequestViewer";

interface CaptureDetailProps {
  capture: WebhookCapture;
}

function buildCurlCommand(capture: WebhookCapture): string {
  const parts = ["curl -X", capture.http_method];
  if (capture.headers) {
    Object.entries(capture.headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== "host" && key.toLowerCase() !== "content-length") {
        parts.push(`-H '${key}: ${value}'`);
      }
    });
  }
  if (capture.body) {
    parts.push(`-d '${capture.body}'`);
  }
  parts.push("'<TARGET_URL>'");
  return parts.join(" \\\n  ");
}

export function CaptureDetail({ capture }: CaptureDetailProps) {
  const [activeTab, setActiveTab] = useState<"headers" | "body" | "query">("body");
  const [curlCopied, setCurlCopied] = useState(false);

  const handleCopyCurl = async () => {
    await copyToClipboard(buildCurlCommand(capture));
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  };

  const tabs = [
    { key: "body" as const, label: "Body", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )},
    { key: "headers" as const, label: "Headers", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    )},
    { key: "query" as const, label: "Query", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    )},
  ];

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "px-3 py-1.5 rounded-lg text-base font-bold tracking-wide",
                HTTP_METHOD_COLORS[capture.http_method] || "bg-slate-100 text-slate-600"
              )}
            >
              {capture.http_method}
            </span>
            <span className="text-xl font-mono text-slate-800 font-medium">{capture.path || "/"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCurl}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-base font-medium text-slate-600 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
              {curlCopied ? "Copied!" : "Copy cURL"}
            </button>
            <Link
              href={`/dashboard/captures/${capture.id}/replay`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg text-base font-semibold transition-all shadow-sm shadow-indigo-500/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Replay
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4 text-base text-slate-400">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatDate(capture.captured_at)}
          </div>
          {capture.source_ip && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              {capture.source_ip}
            </div>
          )}
        </div>
      </div>

      {/* Content tabs */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200/60">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-base font-medium transition-all duration-150 border-b-2 -mb-px",
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          <RequestViewer capture={capture} tab={activeTab} />
        </div>
      </div>
    </div>
  );
}
