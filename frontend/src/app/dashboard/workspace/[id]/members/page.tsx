"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { MemberList } from "@/components/workspace/MemberList";
import { MemberInviteForm } from "@/components/workspace/MemberInviteForm";
import type { WorkspaceMember } from "@/types/workspace";

export default function MembersPage() {
  const params = useParams();
  const { workspace } = useWorkspace(params.id as string);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    try {
      const data = await api.get(`/api/v1/workspaces/${params.id}/members`);
      setMembers(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [params.id]);

  const handleInvite = async (email: string, role: string) => {
    await api.post(`/api/v1/workspaces/${params.id}/members`, { email, role });
    await fetchMembers();
  };

  const handleRemove = async (memberId: string) => {
    await api.delete(`/api/v1/workspaces/${params.id}/members/${memberId}`);
    await fetchMembers();
  };

  const isOwner = workspace?.role === "owner";

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Team Members</h2>
        <p className="text-base text-slate-500 mt-2">Manage who has access to this workspace and their permissions.</p>
      </div>

      {isOwner && (
        <MemberInviteForm onInvite={handleInvite} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading members...</span>
          </div>
        </div>
      ) : (
        <MemberList members={members} isOwner={isOwner} onRemove={handleRemove} />
      )}
    </div>
  );
}
