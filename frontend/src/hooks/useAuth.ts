"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/types";

export function useAuth({ redirectTo }: { redirectTo?: string } = {}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (!token) {
      setLoading(false);
      if (redirectTo) router.replace(redirectTo);
      return;
    }

    const fetchUser = async () => {
      try {
        const data = await api.get("/api/v1/auth/me");
        setUser(data);
      } catch {
        // Token is invalid/expired — clear it
        localStorage.removeItem("session_token");
        setUser(null);
        if (redirectTo) router.replace(redirectTo);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [redirectTo, router]);

  const logout = () => {
    localStorage.removeItem("session_token");
    router.replace("/auth/login");
  };

  return { user, loading, logout };
}
