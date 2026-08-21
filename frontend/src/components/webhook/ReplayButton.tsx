"use client";

import Link from "next/link";

interface ReplayButtonProps {
  captureId: string;
}

export function ReplayButton({ captureId }: ReplayButtonProps) {
  return (
    <Link
      href={`/dashboard/captures/${captureId}/replay`}
      className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-sm font-medium transition-all"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
      Replay
    </Link>
  );
}
