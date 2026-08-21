"use client";

import { useState } from "react";
import { RoleSelect } from "./RoleSelect";

interface MemberInviteFormProps {
  onInvite: (email: string, role: string) => Promise<void>;
}

export function MemberInviteForm({ onInvite }: MemberInviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      await onInvite(email.trim(), role);
      setEmail("");
      setRole("editor");
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-indigo-50">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-700">Invite Member</h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
          required
          className="w-full sm:w-auto sm:flex-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50/50 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
        />
        <RoleSelect value={role} onChange={setRole} />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg font-semibold text-base disabled:opacity-50 transition-all shadow-sm shadow-indigo-500/20"
        >
          {loading ? "Inviting..." : "Invite"}
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}
    </form>
  );
}
