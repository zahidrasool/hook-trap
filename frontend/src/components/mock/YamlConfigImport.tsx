"use client";

import { useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";

interface YamlConfigImportProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  created_count: number;
  endpoints: Array<{
    path: string;
    method: string;
    name?: string;
  }>;
  errors?: string[];
}

const YAML_PLACEHOLDER = `models:
  users:
    _count: 50
    fields:
      name: faker.name
      email: faker.email
      avatar: randomAvatar
      active: randomBool
    has_many:
      - posts

  posts:
    _count: 100
    fields:
      title: faker.sentence
      body: faker.paragraph
    belongs_to: users`;

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
  POST: "bg-blue-50 text-blue-700 ring-blue-200/80",
  PUT: "bg-amber-50 text-amber-700 ring-amber-200/80",
  PATCH: "bg-orange-50 text-orange-700 ring-orange-200/80",
  DELETE: "bg-red-50 text-red-700 ring-red-200/80",
};

export function YamlConfigImport({ workspaceId, isOpen, onClose, onSuccess }: YamlConfigImportProps) {
  const [yamlContent, setYamlContent] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setYamlContent("");
    setOverwrite(false);
    setResult(null);
    setError(null);
    setDragActive(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setYamlContent(text);
      setError(null);
      setResult(null);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".yml") || file.name.endsWith(".yaml"))) {
      handleFileRead(file);
    } else {
      setError("Please drop a .yml or .yaml file");
    }
  };

  const handleImport = async () => {
    if (!yamlContent.trim()) return;
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.post(
        `/api/v1/workspaces/${workspaceId}/import-config`,
        {
          yaml_content: yamlContent,
          overwrite,
        }
      );
      setResult(data);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200/60 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-2 sm:mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-50">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-violet-500">
                <path d="M3 4.5h12M3 9h8M3 13.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 10l-2 4 4-1.5L14 10z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Import YAML Config</h2>
              <p className="text-sm text-slate-500">Generate mock endpoints from a YAML model definition</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* File Upload Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
              dragActive
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-400 mb-2">
              <path d="M14 18V8m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 17v5a2 2 0 002 2h16a2 2 0 002-2v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-base text-slate-500">
              <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-slate-400 mt-1">.yml or .yaml files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".yml,.yaml"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* YAML Editor */}
          <div>
            <label className="block text-base font-medium text-slate-700 mb-1.5">
              YAML Configuration
            </label>
            <textarea
              value={yamlContent}
              onChange={(e) => {
                setYamlContent(e.target.value);
                setError(null);
                setResult(null);
              }}
              rows={14}
              placeholder={YAML_PLACEHOLDER}
              className="w-full px-4 py-3 bg-slate-900 text-emerald-400 border border-slate-700 rounded-lg text-base font-mono shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-600 resize-y"
            />
          </div>

          {/* Overwrite checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500/20 transition-colors"
            />
            <div>
              <span className="text-base font-medium text-slate-700">Overwrite existing</span>
              <p className="text-sm text-slate-500">Replace mock endpoints with matching paths</p>
            </div>
          </label>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-500 mt-0.5 shrink-0">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 5v3.5M8 11h.005" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <p className="text-base text-red-700">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-emerald-500 shrink-0">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-base text-emerald-700 font-medium">
                  Successfully created {result.created_count} endpoint{result.created_count !== 1 ? "s" : ""}
                </p>
              </div>

              {result.endpoints.length > 0 && (
                <div className="border border-slate-200/60 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200/60">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Created Endpoints</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {result.endpoints.map((ep, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ring-1 ring-inset ${METHOD_COLORS[ep.method] || "bg-slate-50 text-slate-600 ring-slate-200/80"}`}>
                          {ep.method}
                        </span>
                        <span className="text-base font-mono text-slate-700">{ep.path}</span>
                        {ep.name && (
                          <span className="text-sm text-slate-400 ml-auto">{ep.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-amber-700 mb-2">Warnings</p>
                  <ul className="space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-sm text-amber-600">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors duration-200"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={importing || !yamlContent.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 transition-all duration-200 shadow-sm shadow-indigo-500/20 inline-flex items-center gap-2"
            >
              {importing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Import
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
