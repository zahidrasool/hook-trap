"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0",
        copied
          ? "text-emerald-500"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      )}
    >
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 3H4.5A1.5 1.5 0 003 4.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
