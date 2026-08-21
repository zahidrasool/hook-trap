"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HTTP_METHOD_COLORS } from "@/lib/utils";
import type { WebhookCapture } from "@/types/webhook";

export default function ReplayPage() {
  const params = useParams();
  const [capture, setCapture] = useState<WebhookCapture | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [headerMods, setHeaderMods] = useState("");
  const [bodyMods, setBodyMods] = useState("");
  const [replaying, setReplaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/v1/captures/${params.id}`).then(setCapture).catch(() => {});
  }, [params.id]);

  const handleReplay = async () => {
    if (!capture || !targetUrl) return;
    setReplaying(true);
    setError("");
    setResult(null);

    try {
      // Create session
      const session = await api.post("/api/v1/replay-sessions", {
        name: `Replay ${new Date().toISOString()}`,
        endpoint_id: capture.endpoint_id,
      });

      // Build modifications
      let modifications: any = {};
      if (headerMods.trim()) {
        try { modifications.headers = JSON.parse(headerMods); } catch { setError("Invalid header JSON"); setReplaying(false); return; }
      }
      if (bodyMods.trim()) {
        try { modifications.body_overrides = JSON.parse(bodyMods); } catch { setError("Invalid body JSON"); setReplaying(false); return; }
      }

      // Execute replay
      const replay = await api.post(`/api/v1/replay-sessions/${session.id}/requests`, {
        capture_id: capture.id,
        target_url: targetUrl,
        modifications: Object.keys(modifications).length > 0 ? modifications : null,
      });

      setResult(replay);
    } catch (err: any) {
      setError(err.message || "Replay failed");
    } finally {
      setReplaying(false);
    }
  };

  if (!capture) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading capture...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full">
      <Link
        href={`/dashboard/captures/${params.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to capture
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Replay Webhook</h1>
        <p className="text-sm text-slate-500 mt-1">Forward a captured webhook to a target URL with optional modifications.</p>
      </div>

      {/* Original Capture */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-slate-100">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-700">Original Capture</h2>
        </div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-bold tracking-wide shrink-0",
              HTTP_METHOD_COLORS[capture.http_method] || "bg-slate-100 text-slate-600"
            )}
          >
            {capture.http_method}
          </span>
          <span className="font-mono text-sm text-slate-600 break-all">{capture.path}</span>
        </div>
        {capture.body && (
          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono mt-2 max-h-40 overflow-auto leading-relaxed selection:bg-indigo-500/30">
            {(() => { try { return JSON.stringify(JSON.parse(capture.body), null, 2); } catch { return capture.body; } })()}
          </pre>
        )}
      </div>

      {/* Replay Configuration */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-indigo-50">
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-700">Replay Configuration</h2>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Target URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://myapp.example.com/webhook"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Header Modifications
            <span className="text-slate-400 font-normal ml-1">(JSON, optional)</span>
          </label>
          <textarea
            value={headerMods}
            onChange={(e) => setHeaderMods(e.target.value)}
            placeholder='{"x-custom-header": "value"}'
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all resize-none"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Body Overrides
            <span className="text-slate-400 font-normal ml-1">(JSON, optional)</span>
          </label>
          <textarea
            value={bodyMods}
            onChange={(e) => setBodyMods(e.target.value)}
            placeholder='{"key": "new_value"}'
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        <button
          onClick={handleReplay}
          disabled={replaying || !targetUrl}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 transition-all shadow-sm shadow-indigo-500/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
          {replaying ? "Replaying..." : "Send Replay"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-emerald-50">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Replay Result</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</span>
              <p className={`text-2xl font-bold mt-1 tabular-nums ${result.response_status >= 400 ? "text-red-500" : "text-emerald-500"}`}>
                {result.response_status || "N/A"}
              </p>
            </div>
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Response Time</span>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{result.response_time_ms}<span className="text-sm font-normal text-slate-400 ml-0.5">ms</span></p>
            </div>
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Replayed At</span>
              <p className="text-sm text-slate-600 mt-2">{new Date(result.replayed_at).toLocaleString()}</p>
            </div>
          </div>

          {result.error_message && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 p-4 rounded-xl mb-4 text-sm border border-red-100">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {result.error_message}
            </div>
          )}

          {result.response_body && (
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Response Body</span>
              <pre className="bg-slate-950 text-slate-100 p-5 rounded-xl text-sm font-mono mt-2 max-h-60 overflow-auto leading-relaxed selection:bg-indigo-500/30">
                {(() => { try { return JSON.stringify(JSON.parse(result.response_body), null, 2); } catch { return result.response_body; } })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
