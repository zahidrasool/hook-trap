"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { Dialog } from "@/components/common/Dialog";
import { CopyButton } from "@/components/common/CopyButton";
import type { Scenario } from "@/types/scenario";

export default function ScenariosPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchScenarios = () => {
    setLoadError(null);
    api
      .get(`/api/v1/workspaces/${workspaceId}/scenarios`)
      .then((data) => setScenarios(data.scenarios ?? []))
      // Surfaced, not swallowed: an empty list and a failed request look
      // identical otherwise, and "you have no scenarios" is a bad thing to
      // tell someone whose request 500'd.
      .catch((err) => setLoadError(err.message || "Could not load scenarios"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchScenarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await api.post(`/api/v1/workspaces/${workspaceId}/scenarios`, {
        name: newName.trim(),
        description: newDescription.trim() || null,
      });
      router.push(`/dashboard/workspace/${workspaceId}/scenarios/${created.slug}`);
    } catch (err: any) {
      setCreateError(err.message || "Could not create the scenario");
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scenarios</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Multi-step tests: drive a webhook, wait for the callback, assert on what came
            back.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Scenario</Button>
      </div>

      {loadError && (
        <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
          <button
            onClick={fetchScenarios}
            className="mt-2 text-sm font-medium text-red-700 dark:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loadError && scenarios.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            No scenarios yet
          </h2>
          <p className="mt-2 mx-auto max-w-md text-slate-500 dark:text-slate-400">
            A scenario chains steps together — send a webhook, wait for your app to call
            back, capture a value from it, assert on the result. Each one gets its own URL
            so its mocks only apply while it runs.
          </p>
          <Button className="mt-6" onClick={() => setShowCreate(true)}>
            Create your first scenario
          </Button>
        </div>
      )}

      <div className="grid gap-4">
        {scenarios.map((scenario) => (
          <Link
            key={scenario.id}
            href={`/dashboard/workspace/${workspaceId}/scenarios/${scenario.slug}`}
            className="group block rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-600 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {scenario.name}
                  </h3>
                  {!scenario.is_active && (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                      inactive
                    </span>
                  )}
                </div>
                {scenario.description && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 truncate">
                    {scenario.description}
                  </p>
                )}
                <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
                  {scenario.steps.length} step{scenario.steps.length === 1 ? "" : "s"}
                  {" · "}
                  {scenario.timeout_seconds}s limit
                </p>
              </div>
              <div
                className="flex items-center gap-2 flex-shrink-0"
                // The row is a link; the copy button inside it must not
                // navigate as well.
                onClick={(event) => event.preventDefault()}
              >
                <code className="hidden sm:block rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
                  {scenario.scenario_url}
                </code>
                <CopyButton text={scenario.scenario_url} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New scenario"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Name
            </label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Checkout completes"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
