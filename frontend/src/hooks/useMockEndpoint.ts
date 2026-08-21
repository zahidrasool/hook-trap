"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MockEndpoint } from "@/types/mock";

export function useMockEndpoint(workspaceShortId: string, mockId: string) {
  const [mock, setMock] = useState<MockEndpoint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/v1/workspaces/${workspaceShortId}/mocks/${mockId}`)
      .then(setMock)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceShortId, mockId]);

  const updateMock = async (updates: Partial<MockEndpoint>) => {
    const updated = await api.patch(`/api/v1/workspaces/${workspaceShortId}/mocks/${mockId}`, updates);
    setMock(updated);
    return updated;
  };

  return { mock, loading, setMock, updateMock };
}
