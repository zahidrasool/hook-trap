"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, HTTP_METHOD_COLORS } from "@/lib/utils";
import { api } from "@/lib/api";
import type { MockEndpoint } from "@/types/mock";

interface MockEndpointCardProps {
  mock: MockEndpoint;
  workspaceId: string;
  onToggle?: (id: string, active: boolean) => void;
}

export function MockEndpointCard({ mock, workspaceId, onToggle }: MockEndpointCardProps) {
  const [isActive, setIsActive] = useState(mock.is_active);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setToggling(true);
    try {
      await api.patch(`/api/v1/workspaces/${workspaceId}/mocks/${mock.id}`, {
        is_active: !isActive,
      });
      setIsActive(!isActive);
      onToggle?.(mock.id, !isActive);
    } catch {
      // revert on error
    } finally {
      setToggling(false);
    }
  };

  const methodColor = HTTP_METHOD_COLORS[mock.method.toUpperCase()] || HTTP_METHOD_COLORS.GET;

  return (
    <Link
      href={`/dashboard/workspace/${workspaceId}/mocks/${mock.id}`}
      className="block group"
    >
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={cn(
                "px-2.5 py-1 rounded-md text-sm font-bold uppercase shrink-0 tracking-wide",
                methodColor
              )}
            >
              {mock.method}
            </span>
            <span className="font-mono text-base text-slate-700 truncate">
              {mock.path}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {/* Request count */}
            <span className="flex items-center gap-1.5 text-sm text-slate-400">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300">
                <path d="M7 1v6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              {mock.request_count} request{mock.request_count !== 1 ? "s" : ""}
            </span>
            {/* Active toggle switch */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-1",
                isActive ? "bg-indigo-500" : "bg-slate-200",
                toggling && "opacity-50 cursor-not-allowed"
              )}
              aria-label={isActive ? "Deactivate mock" : "Activate mock"}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200",
                  isActive ? "translate-x-4.5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>
        {mock.name && (
          <p className="mt-2 text-lg text-slate-500 truncate">{mock.name}</p>
        )}
        <div className="mt-3 flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-50 text-sm text-slate-500 ring-1 ring-inset ring-slate-200/80">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-400">
              <path d="M6 3v6M3 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {mock.response_status}
          </span>
          {mock.response_delay_ms > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-50 text-sm text-slate-500 ring-1 ring-inset ring-slate-200/80">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-400">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6 3.5v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {mock.response_delay_ms}ms
            </span>
          )}
          {mock.error_rate > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-red-50 text-sm text-red-500 ring-1 ring-inset ring-red-200/80">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2l5 8H1L6 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M6 5.5v1.5M6 8.5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {mock.error_rate}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
