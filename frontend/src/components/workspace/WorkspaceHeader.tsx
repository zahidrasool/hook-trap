"use client";

import { CopyButton } from "@/components/common/CopyButton";
import type { Workspace } from "@/types/workspace";

interface WorkspaceHeaderProps {
  workspace: Workspace;
}

export function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  return (
    <div className="mb-8 pb-6 border-b border-slate-200/60">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {workspace.name}
          </h1>
          {workspace.description && (
            <p className="text-slate-500 mt-1 text-base leading-relaxed max-w-xl">
              {workspace.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 inline-flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-200/60">
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="font-mono text-base text-indigo-600 select-all">
          {workspace.mock_base_url}
        </span>
        <CopyButton text={workspace.mock_base_url} />
      </div>
    </div>
  );
}
