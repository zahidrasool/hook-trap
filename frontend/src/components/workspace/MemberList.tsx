"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import type { WorkspaceMember } from "@/types/workspace";

interface MemberListProps {
  members: WorkspaceMember[];
  isOwner: boolean;
  onRemove: (memberId: string) => Promise<void>;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: "bg-gradient-to-r from-indigo-500 to-violet-500 text-white",
  admin: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  editor: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  viewer: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
};

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function MemberList({ members, isOwner, onRemove }: MemberListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await onRemove(memberId);
    } finally {
      setRemovingId(null);
    }
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200/60 shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium">No members yet</p>
        <p className="text-slate-400 text-sm mt-1">Invite someone to collaborate on this workspace.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider">Member</th>
              <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Joined</th>
              {isOwner && <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-slate-400 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((member) => {
              const email = member.email || "Unknown";
              const initial = email.charAt(0).toUpperCase();
              return (
                <tr key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
                        {initial}
                      </div>
                      <span className="text-base text-slate-700 font-medium truncate max-w-[150px] sm:max-w-none">{email}</span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${ROLE_BADGE_STYLES[member.role] || ROLE_BADGE_STYLES.viewer}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-base text-slate-400 hidden md:table-cell">{formatDate(member.joined_at)}</td>
                  {isOwner && (
                    <td className="px-4 sm:px-6 py-4 text-right">
                      {member.role !== "owner" && (
                        <button
                          onClick={() => handleRemove(member.id)}
                          disabled={removingId === member.id}
                          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-500 disabled:opacity-50 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          <span className="hidden sm:inline">{removingId === member.id ? "Removing..." : "Remove"}</span>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
