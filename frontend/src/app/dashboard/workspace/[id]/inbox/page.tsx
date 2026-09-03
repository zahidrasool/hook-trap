"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { InboxEmailSummary, InboxEmail, SmtpCredentials } from "@/types/inbox";

/* ─── helpers ─── */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractName(addr: string) {
  const match = addr.match(/^(.+?)\s*<.*>$/);
  return match ? match[1].trim().replace(/^"|"$/g, "") : addr.split("@")[0];
}

function extractEmail(addr: string) {
  const match = addr.match(/<(.+?)>/);
  return match ? match[1] : addr;
}

/* ─── Send Test Email dialog ─── */
function SmtpTestDialog({
  workspaceId,
  defaultTo,
  onClose,
  onSent,
}: {
  workspaceId: string;
  defaultTo: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("MockLane SMTP test");
  const [body, setBody] = useState(
    "If you can read this, your SMTP credentials work."
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await api.post(`/api/v1/workspaces/${workspaceId}/inbox/smtp-test`, {
        to,
        subject,
        body,
      });
      setSent(true);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Send test email
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-base font-medium text-slate-900 dark:text-white">
              Sent — credentials work.
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              It should appear in the inbox within a second or two.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sends through this workspace&apos;s SMTP credentials, so a success
                here proves the same path an external client would use.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  To
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 resize-y"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !to.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send test"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── SMTP Setup Banner ─── */
function SmtpSetupBanner({
  workspaceId,
  onTestSent,
}: {
  workspaceId: string;
  onTestSent: () => void;
}) {
  const [creds, setCreds] = useState<SmtpCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCreds = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/v1/workspaces/${workspaceId}/inbox/smtp-credentials`);
      setCreds(data);
      setShown(true);
    } catch {
      // user may not be admin
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (shown && creds) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
            </svg>
            SMTP Configuration
          </h3>
          <button onClick={() => setShown(false)} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Point your app&apos;s SMTP settings to MockLane. All emails will land here instead of reaching real recipients.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Host", value: creds.smtp_host },
            { label: "Port", value: String(creds.smtp_port) },
            { label: "Username", value: creds.smtp_username },
            { label: "Password", value: creds.smtp_password },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-400 uppercase w-16 flex-shrink-0">{item.label}</span>
              <code className="text-sm text-slate-700 dark:text-slate-300 font-mono flex-1 truncate">{item.value}</code>
              <button
                onClick={() => copyToClipboard(item.value, item.label)}
                className="text-slate-400 hover:text-indigo-600 flex-shrink-0"
              >
                {copied === item.label ? (
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-slate-900 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1 font-mono">// Node.js (nodemailer)</p>
          <code className="text-xs text-emerald-400 font-mono leading-relaxed whitespace-pre">{`const transport = nodemailer.createTransport({
  host: "${creds.smtp_host}",
  port: ${creds.smtp_port},
  auth: { user: "${creds.smtp_username}", pass: "${creds.smtp_password}" }
});`}</code>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => setTestOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
            Send test email
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Verifies these credentials end to end.
          </span>
        </div>

        {testOpen && (
          <SmtpTestDialog
            workspaceId={workspaceId}
            defaultTo={`test@${creds.smtp_host}`}
            onClose={() => setTestOpen(false)}
            onSent={onTestSent}
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={fetchCreds}
      disabled={loading}
      className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium mb-4"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      </svg>
      {loading ? "Loading..." : "Show SMTP Credentials"}
    </button>
  );
}

/* ─── Main Inbox Page ─── */
export default function InboxPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const [emails, setEmails] = useState<InboxEmailSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"html" | "text" | "headers">("html");

  const fetchEmails = useCallback(async () => {
    try {
      const data = await api.get(`/api/v1/workspaces/${workspaceId}/inbox`);
      setEmails(data.data || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 10000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  const selectEmail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setActiveTab("html");
    try {
      const data = await api.get(`/api/v1/workspaces/${workspaceId}/inbox/${id}`);
      setSelectedEmail(data);
      // Mark as read in list
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const deleteEmail = async (id: string) => {
    try {
      await api.delete(`/api/v1/workspaces/${workspaceId}/inbox/${id}`);
      setEmails((prev) => prev.filter((e) => e.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedEmail(null);
      }
      setTotal((prev) => prev - 1);
    } catch {
      // ignore
    }
  };

  const clearInbox = async () => {
    if (!confirm("Clear all emails in this inbox?")) return;
    try {
      await api.delete(`/api/v1/workspaces/${workspaceId}/inbox`);
      setEmails([]);
      setSelectedId(null);
      setSelectedEmail(null);
      setTotal(0);
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const downloadAttachment = (att: { filename: string; content_type: string; content_base64?: string }) => {
    if (!att.content_base64) return;
    const bin = atob(att.content_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: att.content_type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = att.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Inbox
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {total} email{total !== 1 ? "s" : ""} captured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEmails}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
            </svg>
          </button>
          {emails.length > 0 && (
            <button
              onClick={clearInbox}
              className="text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* SMTP Credentials */}
      <SmtpSetupBanner
        workspaceId={workspaceId}
        onTestSent={() => {
          // Give the SMTP thread a moment to commit before refetching.
          setTimeout(fetchEmails, 800);
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : emails.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No emails yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Configure your application&apos;s SMTP settings to point to MockLane.
            All outgoing emails will be captured here instead of reaching real recipients.
          </p>
        </div>
      ) : (
        /* Split view: email list + detail */
        <div className="flex gap-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" style={{ height: "calc(100vh - 320px)", minHeight: 400 }}>
          {/* Left: email list */}
          <div className="w-96 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => selectEmail(email.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 transition-colors ${
                  selectedId === email.id
                    ? "bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                    email.is_read ? "bg-slate-100 dark:bg-slate-800 text-slate-400" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  }`}>
                    {extractName(email.from_address).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${email.is_read ? "text-slate-600 dark:text-slate-400" : "font-semibold text-slate-900 dark:text-white"}`}>
                        {extractName(email.from_address)}
                      </span>
                      <span className="text-[11px] text-slate-400 flex-shrink-0">{timeAgo(email.received_at)}</span>
                    </div>
                    <p className={`text-sm truncate ${email.is_read ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-100 font-medium"}`}>
                      {email.subject || "(no subject)"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400 truncate">
                        to: {email.to_addresses.map(extractEmail).join(", ")}
                      </span>
                      {email.has_attachments && (
                        <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {!email.is_read && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Right: email detail */}
          <div className="flex-1 overflow-y-auto">
            {!selectedId ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <p className="text-sm">Select an email to preview</p>
                </div>
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : selectedEmail ? (
              <div className="flex flex-col h-full">
                {/* Email header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white pr-4">
                      {selectedEmail.subject || "(no subject)"}
                    </h2>
                    <button
                      onClick={() => deleteEmail(selectedEmail.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                      title="Delete email"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-slate-400 w-10 flex-shrink-0">From</span>
                      <span className="text-slate-700 dark:text-slate-300">{selectedEmail.from_address}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-400 w-10 flex-shrink-0">To</span>
                      <span className="text-slate-700 dark:text-slate-300">{selectedEmail.to_addresses.join(", ")}</span>
                    </div>
                    {selectedEmail.cc_addresses.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-slate-400 w-10 flex-shrink-0">Cc</span>
                        <span className="text-slate-700 dark:text-slate-300">{selectedEmail.cc_addresses.join(", ")}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-slate-400 w-10 flex-shrink-0">Date</span>
                      <span className="text-slate-700">{new Date(selectedEmail.received_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Attachments */}
                  {selectedEmail.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((att, i) => (
                        <button
                          key={i}
                          onClick={() => downloadAttachment(att)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                          </svg>
                          {att.filename}
                          <span className="text-slate-400">({formatSize(att.size)})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 flex-shrink-0">
                  {(["html", "text", "headers"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeTab === tab
                          ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                          : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      {tab === "html" ? "HTML Preview" : tab === "text" ? "Plain Text" : "Headers"}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-auto">
                  {activeTab === "html" && (
                    selectedEmail.html_body ? (
                      <iframe
                        srcDoc={selectedEmail.html_body}
                        sandbox="allow-same-origin"
                        className="w-full h-full border-0"
                        title="Email HTML preview"
                      />
                    ) : (
                      <div className="p-6 text-sm text-slate-400 italic">No HTML content</div>
                    )
                  )}
                  {activeTab === "text" && (
                    <pre className="p-6 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedEmail.text_body || "No plain text content"}
                    </pre>
                  )}
                  {activeTab === "headers" && (
                    <div className="p-6">
                      <table className="w-full text-sm">
                        <tbody>
                          {Object.entries(selectedEmail.headers).map(([key, value]) => (
                            <tr key={key} className="border-b border-slate-50 dark:border-slate-800">
                              <td className="py-2 pr-4 font-mono font-medium text-slate-500 dark:text-slate-400 align-top whitespace-nowrap">{key}</td>
                              <td className="py-2 font-mono text-slate-700 dark:text-slate-300 break-all">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
