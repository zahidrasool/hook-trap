"use client";

import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import type { WebhookCapture } from "@/types/webhook";
import { HTTP_METHOD_COLORS } from "@/lib/utils";

interface CaptureListProps {
  captures: WebhookCapture[];
}

export function CaptureList({ captures }: CaptureListProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Method</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Path</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Content Type</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Size</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Captured</th>
          </tr>
        </thead>
        <tbody>
          {captures.map((capture) => (
            <tr
              key={capture.id}
              className="border-b border-slate-100 hover:bg-slate-50 transition"
            >
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "px-2 py-1 rounded text-xs font-semibold",
                    HTTP_METHOD_COLORS[capture.http_method] || "bg-gray-100 text-gray-800"
                  )}
                >
                  {capture.http_method}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/captures/${capture.id}`}
                  className="text-brand-600 hover:underline text-sm"
                >
                  {capture.path || "/"}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {capture.content_type || "-"}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {capture.body_size} B
              </td>
              <td className="px-4 py-3 text-sm text-slate-500">
                {formatDate(capture.captured_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
