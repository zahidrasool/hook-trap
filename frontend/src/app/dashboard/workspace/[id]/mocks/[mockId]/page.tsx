"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMockEndpoint } from "@/hooks/useMockEndpoint";
import { MockEditor } from "@/components/mock/MockEditor";
import { MockTester } from "@/components/mock/MockTester";
import { Spinner } from "@/components/common/Spinner";
import { cn, HTTP_METHOD_COLORS } from "@/lib/utils";

export default function MockEditorPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const mockId = params.mockId as string;

  const { mock, loading, setMock } = useMockEndpoint(workspaceId, mockId);
  const [showTester, setShowTester] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!mock) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-lg font-medium text-slate-600 mb-2">Mock endpoint not found</p>
        <Link
          href={`/dashboard/workspace/${workspaceId}/mocks`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to mocks
        </Link>
      </div>
    );
  }

  const methodColor = HTTP_METHOD_COLORS[mock.method.toUpperCase()] || HTTP_METHOD_COLORS.GET;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-base mb-6 overflow-hidden min-w-0">
        <Link
          href={`/dashboard/workspace/${workspaceId}/mocks`}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors duration-200 font-medium shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Mock Endpoints
        </Link>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300 shrink-0">
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-slate-600 font-medium truncate min-w-0">{mock.name || mock.path}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
          <span className={cn("px-3 py-1.5 rounded-md text-sm font-bold uppercase tracking-wide shrink-0", methodColor)}>
            {mock.method}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 truncate">{mock.name || mock.path}</h1>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium shrink-0 ring-1 ring-inset",
              mock.is_active
                ? "bg-emerald-50 text-emerald-600 ring-emerald-200/80"
                : "bg-slate-50 text-slate-500 ring-slate-200/80"
            )}
          >
            {mock.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-base text-slate-400 shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300">
            <path d="M7 1v6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          {mock.request_count} request{mock.request_count !== 1 ? "s" : ""}
        </div>
      </div>

      {mock.description && (
        <p className="text-base text-slate-500 mb-5 leading-relaxed">{mock.description}</p>
      )}

      {/* URL Bar */}
      {mock.mock_url && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 rounded-lg border border-slate-200/60 px-4 py-3 mb-6 shadow-sm">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={cn("px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide shrink-0", methodColor)}>
              {mock.method}
            </span>
            <span className="font-mono text-base text-slate-700 flex-1 break-all select-all">{mock.mock_url}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              navigator.clipboard.writeText(mock.mock_url || "");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 2.5H3.5a1 1 0 00-1 1v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Copy
          </button>
          <button
            onClick={() => setShowTester(true)}
            className="px-3.5 py-1.5 text-sm font-medium bg-gradient-to-r from-violet-500 to-indigo-500 hover:brightness-110 text-white rounded-lg shadow-sm shadow-violet-500/20 transition-all duration-200 active:shadow-none"
          >
            Try It
          </button>
          </div>
        </div>
      )}

      {/* Editor */}
      <MockEditor
        mock={mock}
        workspaceId={workspaceId}
        onUpdate={setMock}
      />

      {/* Tester Dialog */}
      {mock.mock_url && (
        <MockTester
          open={showTester}
          onClose={() => setShowTester(false)}
          url={mock.mock_url}
          method={mock.method}
        />
      )}
    </div>
  );
}
