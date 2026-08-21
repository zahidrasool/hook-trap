"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CaptureList } from "@/components/webhook/CaptureList";
import { CopyButton } from "@/components/common/CopyButton";
import type { WebhookCapture, Endpoint } from "@/types/webhook";

export default function CapturesPage() {
  const [captures, setCaptures] = useState<WebhookCapture[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEndpointName, setNewEndpointName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [capturesData, endpointsData] = await Promise.all([
          api.get("/api/v1/captures"),
          api.get("/api/v1/endpoints").catch(() => ({ data: [] })),
        ]);
        setCaptures(capturesData.data || []);
        setEndpoints(Array.isArray(endpointsData) ? endpointsData : endpointsData.data || []);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");

    try {
      const endpoint = await api.post("/api/v1/endpoints", {
        name: newEndpointName || null,
      });
      setEndpoints((prev) => [endpoint, ...prev]);
      setNewEndpointName("");
      setShowCreateForm(false);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create endpoint");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Webhook Captures</h1>
          <p className="text-base text-slate-500 mt-2">Monitor and inspect incoming webhook requests.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-semibold transition-all ${
            showCreateForm
              ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
              : "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-sm shadow-indigo-500/20"
          }`}
        >
          {showCreateForm ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Endpoint
            </>
          )}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateEndpoint} className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-indigo-50">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-700">Create Webhook Endpoint</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newEndpointName}
              onChange={(e) => setNewEndpointName(e.target.value)}
              placeholder="Endpoint name (optional)"
              className="w-full sm:w-auto sm:flex-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50/50 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg font-semibold text-base disabled:opacity-50 transition-all shadow-sm shadow-indigo-500/20"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
          {createError && (
            <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {createError}
            </div>
          )}
        </form>
      )}

      {/* Endpoints */}
      {endpoints.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Endpoints</h2>
          <div className="space-y-2">
            {endpoints.map((ep) => (
              <div
                key={ep.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-xl border border-slate-200/60 shadow-sm px-4 sm:px-5 py-3.5 group hover:border-slate-300/80 transition-all gap-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded-lg bg-emerald-50 shrink-0">
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium text-base text-slate-700">{ep.name || ep.short_id}</span>
                    <span className="block sm:inline sm:ml-3 font-mono text-sm text-slate-400 break-all">{ep.endpoint_url}</span>
                  </div>
                </div>
                <CopyButton text={ep.endpoint_url} label="Copy URL" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Captures */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading captures...</span>
          </div>
        </div>
      ) : captures.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200/60 shadow-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
            </svg>
          </div>
          <p className="text-slate-600 font-medium text-xl">No captures yet</p>
          <p className="text-base text-slate-400 mt-2 max-w-sm mx-auto">
            Create an endpoint and send a webhook to see captures here.
          </p>
        </div>
      ) : (
        <CaptureList captures={captures} />
      )}
    </div>
  );
}
