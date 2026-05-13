"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CaptureList } from "@/components/webhook/CaptureList";
import type { WebhookCapture } from "@/types/webhook";

export default function CapturesPage() {
  const [captures, setCaptures] = useState<WebhookCapture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCaptures = async () => {
      try {
        const data = await api.get("/api/v1/captures");
        setCaptures(data.data);
      } catch (err) {
        console.error("Failed to fetch captures:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCaptures();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Webhook Captures</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading captures...</div>
      ) : captures.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 mb-2">No captures yet</p>
          <p className="text-sm text-slate-400">
            Create an endpoint and send a webhook to see captures here.
          </p>
        </div>
      ) : (
        <CaptureList captures={captures} />
      )}
    </div>
  );
}
