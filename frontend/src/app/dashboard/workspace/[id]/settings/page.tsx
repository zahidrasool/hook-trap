"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { CopyButton } from "@/components/common/CopyButton";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { workspace, loading, setWorkspace } = useWorkspace(params.id as string);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // API Access state
  const [isPublic, setIsPublic] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [togglingAccess, setTogglingAccess] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [apiAccessInitialized, setApiAccessInitialized] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-red-500 font-medium">Workspace not found</p>
      </div>
    );
  }

  if (!initialized) {
    setName(workspace.name);
    setDescription(workspace.description || "");
    setInitialized(true);
  }

  if (!apiAccessInitialized) {
    setIsPublic((workspace as any).is_public ?? true);
    setApiKey((workspace as any).api_key || "");
    setApiAccessInitialized(true);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const updated = await api.patch(`/api/v1/workspaces/${params.id}`, {
        name,
        description: description || null,
      });
      setWorkspace(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to update workspace");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async () => {
    setTogglingAccess(true);
    try {
      const updated = await api.patch(`/api/v1/workspaces/${params.id}`, {
        is_public: !isPublic,
      });
      setIsPublic(updated.is_public ?? !isPublic);
      if (updated.api_key) setApiKey(updated.api_key);
      setWorkspace(updated);
    } catch (err: any) {
      setError(err.message || "Failed to update access settings");
    } finally {
      setTogglingAccess(false);
    }
  };

  const handleRegenerateKey = async () => {
    setRegenerating(true);
    try {
      const data = await api.post(`/api/v1/workspaces/${params.id}/regenerate-api-key`, {});
      setApiKey(data.api_key);
      setShowApiKey(true);
    } catch (err: any) {
      setError(err.message || "Failed to regenerate API key");
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/v1/workspaces/${params.id}`);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to delete workspace");
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Workspace Settings</h2>
        <p className="text-base text-slate-500 dark:text-slate-400 mt-2">Manage your workspace configuration and preferences.</p>
      </div>

      {/* General Settings */}
      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">General</h3>
        </div>

        <div className="mb-5">
          <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Workspace Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all dark:text-white"
          />
        </div>

        <div className="mb-5">
          <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all resize-none dark:text-white"
          />
        </div>

        <div className="mb-5">
          <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mock Base URL</label>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2.5 border border-slate-200/60 dark:border-slate-700">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="font-mono text-base text-indigo-600 dark:text-indigo-400 flex-1 truncate select-all">{workspace.mock_base_url}</span>
            <CopyButton text={workspace.mock_base_url} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Settings saved successfully.
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg font-semibold text-base disabled:opacity-50 transition-all shadow-sm shadow-indigo-500/20"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* API Access */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20">
              <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">API Access</h3>
              <p className="text-base text-slate-500 dark:text-slate-400 mt-1">Control how your mock endpoints are accessed</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-base font-medium text-slate-900 dark:text-white">Public Access</label>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">When disabled, an API key is required to access mock endpoints</p>
            </div>
            <button
              type="button"
              onClick={handleTogglePublic}
              disabled={togglingAccess}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 ${isPublic ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'} ${togglingAccess ? 'opacity-50' : ''}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${isPublic ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
            </button>
          </div>

          {/* API Key display (only when private) */}
          {!isPublic && (
            <div className="space-y-3">
              <label className="text-base font-medium text-slate-700 dark:text-slate-300">API Key</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <code className="flex-1 bg-slate-900 text-emerald-400 px-4 py-2.5 rounded-lg font-mono text-sm break-all select-all">
                  {showApiKey ? apiKey : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                </code>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors duration-200"
                  title={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.5 2.5l11 11M6.5 6.8a2 2 0 002.7 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M4.3 4.6C3 5.6 2 7.2 1.5 8c.7 1.2 2.7 4 6.5 4 1.2 0 2.2-.3 3.1-.8M8 4c3.8 0 5.8 2.8 6.5 4-.3.5-.8 1.3-1.5 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1.5 8c.7-1.2 2.7-4 6.5-4s5.8 2.8 6.5 4c-.7 1.2-2.7 4-6.5 4S2.2 9.2 1.5 8z" stroke="currentColor" strokeWidth="1.3"/>
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                  )}
                </button>
                <CopyButton text={apiKey} />
              </div>
              <button
                type="button"
                onClick={handleRegenerateKey}
                disabled={regenerating}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors duration-200 disabled:opacity-50"
              >
                {regenerating ? "Regenerating..." : "Regenerate API Key"}
              </button>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mt-3">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Usage:</p>
                <code className="text-xs text-slate-600 dark:text-slate-300 font-mono break-all">
                  curl -H &quot;X-API-Key: {showApiKey && apiKey ? apiKey : "<your-api-key>"}&quot; https://mocklane.com/m/{params.id}/your-endpoint
                </code>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-red-200/60 dark:border-red-800/60 p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
        </div>
        <p className="text-base text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          Deleting this workspace will permanently remove all mock endpoints, logs, and member associations. This action cannot be undone.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-5 py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-semibold text-base transition-all"
          >
            Delete Workspace
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-base disabled:opacity-50 transition-all shadow-sm shadow-red-500/20"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-semibold text-base hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
