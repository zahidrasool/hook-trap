"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Workspace } from "@/types/workspace";

export function useWorkspace(shortId: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/v1/workspaces/${shortId}`)
      .then(setWorkspace)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [shortId]);

  return { workspace, loading, error, setWorkspace };
}
