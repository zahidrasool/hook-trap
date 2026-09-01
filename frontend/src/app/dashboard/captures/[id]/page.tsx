"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { CaptureDetail } from "@/components/webhook/CaptureDetail";
import { ReplayButton } from "@/components/webhook/ReplayButton";
import type { WebhookCapture } from "@/types/webhook";

export default function CaptureDetailPage() {
  const params = useParams();
  const [capture, setCapture] = useState<WebhookCapture | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCapture = async () => {
      try {
        const data = await api.get(`/api/v1/captures/${params.id}`);
        setCapture(data);
      } catch (err) {
        console.error("Failed to fetch capture:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCapture();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!capture) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-red-500 font-medium">Capture not found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/captures"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to captures
        </Link>
        <ReplayButton captureId={capture.id} />
      </div>
      <CaptureDetail capture={capture} />
    </div>
  );
}
