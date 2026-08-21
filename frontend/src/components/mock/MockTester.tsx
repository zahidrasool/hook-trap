"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Dialog } from "@/components/common/Dialog";
import { cn, HTTP_METHOD_COLORS } from "@/lib/utils";

interface MockTesterProps {
  open: boolean;
  onClose: () => void;
  url: string;
  method: string;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

interface TesterResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
}

export function MockTester({ open, onClose, url, method: initialMethod }: MockTesterProps) {
  const [method, setMethod] = useState(initialMethod.toUpperCase());
  const [requestUrl, setRequestUrl] = useState(url);
  const [requestBody, setRequestBody] = useState("");
  const [requestHeaders, setRequestHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: "Content-Type", value: "application/json" },
  ]);
  const [response, setResponse] = useState<TesterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addHeader = () => {
    setRequestHeaders([...requestHeaders, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setRequestHeaders(requestHeaders.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    const headers: Record<string, string> = {};
    requestHeaders.forEach(({ key, value }) => {
      if (key.trim()) headers[key.trim()] = value;
    });

    const startTime = performance.now();
    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
      };
      if (method !== "GET" && method !== "HEAD" && requestBody.trim()) {
        fetchOptions.body = requestBody;
      }

      const res = await fetch(requestUrl, fetchOptions);
      const endTime = performance.now();

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let body = "";
      try {
        body = await res.text();
        // Try to pretty-print JSON
        const parsed = JSON.parse(body);
        body = JSON.stringify(parsed, null, 2);
      } catch {
        // keep raw text
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body,
        time: Math.round(endTime - startTime),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const methodColor = HTTP_METHOD_COLORS[method] || HTTP_METHOD_COLORS.GET;

  return (
    <Dialog open={open} onClose={onClose} title="Mock Tester" className="w-full max-w-3xl mx-4 sm:mx-auto">
      <div className="space-y-5">
        {/* Method + URL */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={cn(
                  "appearance-none px-3 py-2.5 pr-8 border border-slate-200 rounded-lg text-sm font-bold uppercase bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none cursor-pointer",
                  methodColor
                )}
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <Button onClick={handleSend} disabled={loading} loading={loading} className="sm:hidden">
              {loading ? "..." : "Send"}
            </Button>
          </div>
          <input
            type="text"
            value={requestUrl}
            onChange={(e) => setRequestUrl(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-base font-mono bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300 min-w-0"
          />
          <Button onClick={handleSend} disabled={loading} loading={loading} className="hidden sm:inline-flex">
            {loading ? "Sending..." : "Send"}
          </Button>
        </div>

        {/* Request Headers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Headers</label>
            <button
              onClick={addHeader}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Add
            </button>
          </div>
          <div className="space-y-1.5">
            {requestHeaders.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => {
                    const updated = [...requestHeaders];
                    updated[index] = { ...updated[index], key: e.target.value };
                    setRequestHeaders(updated);
                  }}
                  placeholder="Header"
                  className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-md text-base bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => {
                    const updated = [...requestHeaders];
                    updated[index] = { ...updated[index], value: e.target.value };
                    setRequestHeaders(updated);
                  }}
                  placeholder="Value"
                  className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-md text-base bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Request Body */}
        {method !== "GET" && method !== "HEAD" && (
          <div>
            <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Body
            </label>
            <div className="relative rounded-lg overflow-hidden border border-slate-700/30">
              <div className="absolute top-0 left-0 right-0 h-7 bg-slate-800 flex items-center px-3 gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
                <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
                <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
              </div>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="w-full h-28 font-mono text-base p-3 pt-10 bg-slate-900 text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/40 placeholder:text-slate-600 selection:bg-indigo-500/30"
                placeholder='{"key": "value"}'
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm ring-1 ring-inset ring-red-100">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="border-t border-slate-200/60 pt-5 space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-800">Response</h3>
              <span
                className={cn("px-2.5 py-0.5 rounded-md text-lg font-bold ring-1 ring-inset", {
                  "bg-emerald-50 text-emerald-700 ring-emerald-600/20": response.status < 300,
                  "bg-amber-50 text-amber-700 ring-amber-600/20":
                    response.status >= 300 && response.status < 400,
                  "bg-red-50 text-red-700 ring-red-600/20": response.status >= 400,
                })}
              >
                {response.status} {response.statusText}
              </span>
              <span className="text-sm text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md ring-1 ring-inset ring-slate-200/80 font-mono">
                {response.time}ms
              </span>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Headers</label>
              <pre className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-sm font-mono overflow-auto max-h-24 text-slate-600">
                {JSON.stringify(response.headers, null, 2)}
              </pre>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Body</label>
              <div className="relative rounded-lg overflow-hidden border border-slate-700/30">
                <div className="absolute top-0 left-0 right-0 h-7 bg-slate-800 flex items-center px-3 gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
                  <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
                  <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
                </div>
                <pre className="bg-slate-900 text-emerald-400 p-4 pt-10 text-base font-mono overflow-auto max-h-64 selection:bg-indigo-500/30">
                  {response.body || "(empty)"}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
