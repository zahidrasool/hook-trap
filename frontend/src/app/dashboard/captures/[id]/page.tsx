"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { CaptureDetail } from "@/components/webhook/CaptureDetail";
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

  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>;
  if (!capture) return <div className="text-center py-12 text-red-500">Capture not found</div>;

  return <CaptureDetail capture={capture} />;
}
