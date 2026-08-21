"use client";

import { useState } from "react";
import { CopyButton } from "@/components/common/CopyButton";

interface MockUrlBarProps {
  url: string;
  method: string;
}

export function MockUrlBar({ url, method }: MockUrlBarProps) {
  const [showTester, setShowTester] = useState(false);

  return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200/60 px-4 py-2.5 mb-4 shadow-sm">
      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-bold uppercase tracking-wide ring-1 ring-inset ring-indigo-200/60">
        {method}
      </span>
      <span className="font-mono text-sm text-slate-700 flex-1 truncate select-all">{url}</span>
      <CopyButton text={url} />
      <button
        onClick={() => setShowTester(!showTester)}
        className="px-3.5 py-1.5 text-sm font-medium bg-gradient-to-r from-violet-500 to-indigo-500 hover:brightness-110 text-white rounded-lg shadow-sm shadow-violet-500/20 transition-all duration-200 active:shadow-none"
      >
        Try It
      </button>
    </div>
  );
}
