"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Alert } from "@/components/common/Alert";
import { api } from "@/lib/api";
import { cn, HTTP_METHOD_COLORS } from "@/lib/utils";

interface DetectedEndpoint {
  path: string;
  method: string;
  summary?: string;
  selected: boolean;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface OpenAPIImportWizardProps {
  workspaceId: string;
  onComplete?: () => void;
}

const STEP_LABELS = ["Upload Spec", "Select Endpoints", "Results"];

export function OpenAPIImportWizard({ workspaceId, onComplete }: OpenAPIImportWizardProps) {
  const [step, setStep] = useState(1);
  const [specContent, setSpecContent] = useState("");
  const [endpoints, setEndpoints] = useState<DetectedEndpoint[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSpecContent(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!specContent.trim()) {
      setError("Please provide an OpenAPI specification.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.post(`/api/v1/workspaces/${workspaceId}/openapi/preview`, {
        content: specContent,
      });
      setEndpoints(
        (data.endpoints || []).map((ep: { path: string; method: string; summary?: string }) => ({
          ...ep,
          selected: true,
        }))
      );
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse spec");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedEndpoints = endpoints
        .filter((ep) => ep.selected)
        .map(({ path, method }) => ({ path, method }));

      const data = await api.post(`/api/v1/workspaces/${workspaceId}/openapi/import`, {
        content: specContent,
        endpoints: selectedEndpoints,
      });
      setResult(data);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleEndpoint = (index: number) => {
    setEndpoints(
      endpoints.map((ep, i) => (i === index ? { ...ep, selected: !ep.selected } : ep))
    );
  };

  const toggleAll = (selected: boolean) => {
    setEndpoints(endpoints.map((ep) => ({ ...ep, selected })));
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-6 sm:mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base font-semibold transition-all duration-300 ring-2",
                  step >= s
                    ? "bg-indigo-500 text-white ring-indigo-500/30 shadow-lg shadow-indigo-500/20"
                    : "bg-white text-slate-400 ring-slate-200"
                )}
              >
                {step > s ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 8l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  s
                )}
              </div>
              <span className={cn(
                "text-xs font-medium mt-1.5 whitespace-nowrap hidden sm:block",
                step >= s ? "text-indigo-600" : "text-slate-400"
              )}>
                {STEP_LABELS[s - 1]}
              </span>
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "w-10 sm:w-20 h-0.5 mx-2 sm:mx-3 mb-0 sm:mb-5 rounded-full transition-all duration-300",
                  step > s ? "bg-indigo-500" : "bg-slate-200"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-5">
          <Alert type="error" dismissible>{error}</Alert>
        </div>
      )}

      {/* Step 1: Input */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Provide OpenAPI Specification</h2>
          <p className="text-base text-slate-500 mb-6">
            Paste your OpenAPI YAML/JSON spec or upload a file.
          </p>

          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Upload File
            </label>
            <label className="group cursor-pointer block">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-500 mb-3 transition-all duration-200">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 13v2a2 2 0 002 2h8a2 2 0 002-2v-2M10 3v10M7 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-base font-medium text-slate-600 group-hover:text-indigo-600 transition-colors duration-200">
                  Drop your file here or click to browse
                </p>
                <p className="text-sm text-slate-400 mt-1">Supports .json, .yaml, .yml</p>
              </div>
              <input
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200"></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-sm text-slate-400 font-medium">or paste content</span>
            </div>
          </div>

          <div className="mb-6">
            <div className="relative rounded-lg overflow-hidden border border-slate-700/30 shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-8 bg-slate-800 flex items-center px-3 gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600/80"></span>
                <span className="ml-3 text-[10px] text-slate-500 font-mono uppercase tracking-wider">openapi spec</span>
              </div>
              <textarea
                value={specContent}
                onChange={(e) => setSpecContent(e.target.value)}
                className="w-full h-64 font-mono text-base p-4 pt-12 bg-slate-900 text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/40 placeholder:text-slate-600 selection:bg-indigo-500/30"
                placeholder={"openapi: 3.0.0\ninfo:\n  title: My API\n  version: 1.0.0\npaths:\n  /users:\n    get:\n      summary: List users"}
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handlePreview} disabled={loading || !specContent.trim()} loading={loading}>
              {loading ? "Parsing..." : "Preview Endpoints"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Preview Detected Endpoints</h2>
          <p className="text-base text-slate-500 mb-5">
            {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""} detected. Select which ones to import.
          </p>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => toggleAll(true)}
              className="text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
            >
              Select All
            </button>
            <span className="text-sm text-slate-200">|</span>
            <button
              onClick={() => toggleAll(false)}
              className="text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
            >
              Deselect All
            </button>
          </div>

          <div className="rounded-xl border border-slate-200/60 divide-y divide-slate-100 max-h-96 overflow-auto mb-5 shadow-sm">
            {endpoints.map((ep, index) => {
              const methodColor =
                HTTP_METHOD_COLORS[ep.method.toUpperCase()] || HTTP_METHOD_COLORS.GET;
              return (
                <label
                  key={`${ep.method}-${ep.path}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150",
                    ep.selected
                      ? "hover:bg-indigo-50/40"
                      : "opacity-40 hover:opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={ep.selected}
                    onChange={() => toggleEndpoint(index)}
                    className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500/20 transition-colors duration-200"
                  />
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-sm font-bold uppercase shrink-0 tracking-wide",
                      methodColor
                    )}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-base text-slate-700 break-all">{ep.path}</span>
                  {ep.summary && (
                    <span className="text-sm text-slate-400 truncate ml-auto">
                      {ep.summary}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={loading || endpoints.filter((ep) => ep.selected).length === 0}
              loading={loading}
            >
              {loading
                ? "Importing..."
                : `Import ${endpoints.filter((ep) => ep.selected).length} Endpoints`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && result && (
        <div>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Import Complete</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-emerald-200/60 p-5 text-center shadow-sm">
              <span className="text-3xl font-bold text-emerald-600 tabular-nums">{result.created}</span>
              <p className="text-sm text-emerald-500 mt-1 font-medium">Created</p>
            </div>
            <div className="bg-white rounded-xl border border-amber-200/60 p-5 text-center shadow-sm">
              <span className="text-3xl font-bold text-amber-600 tabular-nums">{result.skipped}</span>
              <p className="text-sm text-amber-500 mt-1 font-medium">Skipped</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200/60 p-5 text-center shadow-sm">
              <span className="text-3xl font-bold text-red-600 tabular-nums">{result.errors.length}</span>
              <p className="text-sm text-red-500 mt-1 font-medium">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-5">
              <Alert type="warning">
                <ul className="list-disc list-inside text-sm space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onComplete}>Go to Mocks</Button>
          </div>
        </div>
      )}
    </div>
  );
}
