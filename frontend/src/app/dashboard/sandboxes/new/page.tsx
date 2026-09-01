"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PrefixCheckResponse } from "@/types/sandbox";

const RETENTION_OPTIONS = [
  { label: "Forever", value: "" },
  { label: "1 day", value: "1" },
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
];

export default function NewSandboxPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [retentionDays, setRetentionDays] = useState("");

  const [prefixStatus, setPrefixStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [prefixSuggestion, setPrefixSuggestion] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePrefixChange = (value: string) => {
    // Only allow lowercase a-z, 0-9, hyphens
    const filtered = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setPrefix(filtered);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!filtered) {
      setPrefixStatus("idle");
      setPrefixSuggestion(null);
      return;
    }

    setPrefixStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const data: PrefixCheckResponse = await api.get(
          `/api/v1/sandboxes/check-prefix/${encodeURIComponent(filtered)}`
        );
        setPrefixStatus(data.available ? "available" : "taken");
        setPrefixSuggestion(data.suggestion ?? null);
      } catch {
        setPrefixStatus("idle");
      }
    }, 400);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prefix.trim()) return;
    if (prefixStatus === "taken") return;

    setSubmitting(true);
    setError(null);

    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const sandbox = await api.post("/api/v1/sandboxes", {
        name: name.trim(),
        email_prefix: prefix.trim(),
        description: description.trim() || null,
        tags: parsedTags,
        email_retention_days: retentionDays ? parseInt(retentionDays, 10) : null,
      });
      router.push(`/dashboard/sandboxes/${sandbox.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sandbox");
      setSubmitting(false);
    }
  };

  const prefixIndicator = () => {
    if (prefixStatus === "checking") {
      return (
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <span className="w-3 h-3 border border-slate-300 border-t-indigo-500 rounded-full animate-spin inline-block" />
          Checking...
        </span>
      );
    }
    if (prefixStatus === "available") {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Available
        </span>
      );
    }
    if (prefixStatus === "taken") {
      return (
        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Taken
          {prefixSuggestion && (
            <button
              type="button"
              onClick={() => handlePrefixChange(prefixSuggestion)}
              className="ml-1 underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              Try &ldquo;{prefixSuggestion}&rdquo;
            </button>
          )}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/sandboxes"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Sandbox</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Set up a dedicated email inbox for your project</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My App Sandbox"
            required
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        {/* Email prefix */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Email Prefix <span className="text-red-500">*</span>
          </label>
          <div className="flex items-stretch">
            <input
              type="text"
              value={prefix}
              onChange={(e) => handlePrefixChange(e.target.value)}
              placeholder="my-app"
              required
              className="flex-1 px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-l-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
            <span className="flex items-center px-3.5 bg-slate-50 dark:bg-slate-800 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-lg text-sm text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
              @inbox.mocklane.com
            </span>
          </div>
          <div className="mt-1.5 min-h-[20px]">{prefixIndicator()}</div>
          <p className="text-xs text-slate-400 mt-0.5">Only lowercase letters, numbers, and hyphens are allowed.</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of what this sandbox is for..."
            rows={2}
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Tags <span className="text-slate-400 font-normal">(optional, comma-separated)</span>
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="staging, email-verify, notifications"
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        {/* Retention */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Email Retention <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white dark:bg-slate-800"
          >
            {RETENTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Emails older than this will be automatically deleted.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !prefix.trim() || prefixStatus === "taken" || prefixStatus === "checking"}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {submitting && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {submitting ? "Creating..." : "Create Sandbox"}
          </button>
          <Link
            href="/dashboard/sandboxes"
            className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
