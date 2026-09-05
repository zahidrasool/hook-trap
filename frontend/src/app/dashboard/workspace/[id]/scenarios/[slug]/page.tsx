"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { Dialog } from "@/components/common/Dialog";
import { CopyButton } from "@/components/common/CopyButton";
import { RunStatusBadge } from "@/components/scenario/RunStatusBadge";
import { isTerminal, type RunSummary, type Scenario } from "@/types/scenario";

const STARTER_STEPS = `[
  {
    "type": "http_request",
    "method": "POST",
    "url": "https://example.com/checkout",
    "body": { "amount": 4200 },
    "capture": { "orderId": "response.body.id" },
    "assert": ["status == 200"]
  }
]`;

/** Parse, but report where it broke rather than just refusing to save. */
function parseJson(text: string, expect: "array" | "object") {
  if (!text.trim()) return { value: expect === "array" ? [] : {}, error: null };
  try {
    const value = JSON.parse(text);
    const actual = Array.isArray(value) ? "array" : typeof value;
    if (expect === "array" && actual !== "array") {
      return { value: null, error: `Expected a JSON array, got ${actual}` };
    }
    if (expect === "object" && (actual !== "object" || value === null)) {
      return { value: null, error: `Expected a JSON object, got ${actual}` };
    }
    return { value, error: null };
  } catch (err: any) {
    return { value: null, error: err.message || "Invalid JSON" };
  }
}

export default function ScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const slug = params.slug as string;
  const base = `/api/v1/workspaces/${workspaceId}/scenarios/${slug}`;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [variablesText, setVariablesText] = useState("");
  const [timeout, setTimeoutSeconds] = useState(120);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const stepsParsed = parseJson(stepsText, "array");
  const variablesParsed = parseJson(variablesText, "object");
  const jsonError = stepsParsed.error || variablesParsed.error;

  const applyScenario = (data: Scenario) => {
    setScenario(data);
    setName(data.name);
    setDescription(data.description ?? "");
    setStepsText(JSON.stringify(data.steps ?? [], null, 2));
    setVariablesText(JSON.stringify(data.variables ?? {}, null, 2));
    setTimeoutSeconds(data.timeout_seconds);
    setIsActive(data.is_active);
  };

  const fetchRuns = useCallback(async () => {
    try {
      const data = await api.get(`${base}/runs?limit=20`);
      setRuns(data.runs ?? []);
      return data.runs ?? [];
    } catch {
      // History is secondary to the editor; a failure here must not blank the
      // page someone is mid-edit in.
      return [];
    }
  }, [base]);

  useEffect(() => {
    let cancelled = false;
    api
      .get(base)
      .then((data) => {
        if (!cancelled) applyScenario(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Could not load this scenario");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetchRuns();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // Poll only while something is actually in flight. A dashboard that polls
  // forever is a dashboard that keeps a laptop awake and a server busy for no
  // reason — every run reaches a terminal status, so there is always an end.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const anyInFlight = runs.some((run) => !isTerminal(run.status));

  useEffect(() => {
    if (!anyInFlight) {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    if (pollTimer.current) return;
    pollTimer.current = setInterval(fetchRuns, 1500);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [anyInFlight, fetchRuns]);

  const handleSave = async () => {
    if (jsonError) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.patch(base, {
        name: name.trim(),
        description: description.trim() || null,
        steps: stepsParsed.value,
        variables: variablesParsed.value,
        timeout_seconds: timeout,
        is_active: isActive,
      });
      applyScenario(updated);
      setSavedAt(Date.now());
      // The slug is derived from the name, so renaming moves the page.
      if (updated.slug !== slug) {
        router.replace(
          `/dashboard/workspace/${workspaceId}/scenarios/${updated.slug}`
        );
      }
    } catch (err: any) {
      setSaveError(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setTriggering(true);
    setRunError(null);
    try {
      await api.post(`${base}/run`, { variables: {} });
      await fetchRuns();
    } catch (err: any) {
      setRunError(err.message || "Could not start a run");
    } finally {
      setTriggering(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(base);
      router.push(`/dashboard/workspace/${workspaceId}/scenarios`);
    } catch (err: any) {
      setRunError(err.message || "Could not delete");
      setShowDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (loadError || !scenario) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-500 font-medium">{loadError || "Scenario not found"}</p>
        <Link
          href={`/dashboard/workspace/${workspaceId}/scenarios`}
          className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 underline"
        >
          Back to scenarios
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <Link
        href={`/dashboard/workspace/${workspaceId}/scenarios`}
        className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        ← Scenarios
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
            {scenario.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            /{scenario.slug}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setShowDelete(true)}>
            Delete
          </Button>
          <Button onClick={handleRun} disabled={triggering || !scenario.is_active}>
            {triggering ? "Starting..." : "Run now"}
          </Button>
        </div>
      </div>

      {!scenario.is_active && (
        <p className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          This scenario is inactive, so it cannot be run. Re-activate it below.
        </p>
      )}
      {runError && (
        <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {runError}
        </p>
      )}

      {/* URLs */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <UrlCard
          label="Scenario URL"
          hint="Mocks defined by this scenario serve here, overriding the workspace's."
          url={scenario.scenario_url}
        />
        <UrlCard
          label="Capture URL"
          hint="Where wait_for_webhook listens. Point your app's callback here."
          url={scenario.capture_url}
        />
      </div>

      {/* Editor */}
      <section className="mt-8 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 dark:text-white">Definition</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Steps"
            hint="A JSON array. Types: http_request, send_webhook, wait_for_webhook, wait_for_email, delay."
          >
            <textarea
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              spellCheck={false}
              rows={16}
              placeholder={STARTER_STEPS}
              className={`${inputClass} font-mono text-sm`}
            />
          </Field>
          {stepsParsed.error && <ErrorLine>Steps: {stepsParsed.error}</ErrorLine>}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Field
              label="Variables"
              hint="Defaults for {{placeholders}}. A trigger can override them."
            >
              <textarea
                value={variablesText}
                onChange={(e) => setVariablesText(e.target.value)}
                spellCheck={false}
                rows={6}
                className={`${inputClass} font-mono text-sm`}
              />
            </Field>
            {variablesParsed.error && (
              <ErrorLine>Variables: {variablesParsed.error}</ErrorLine>
            )}
          </div>
          <div className="space-y-4">
            <Field label="Time limit (seconds)">
              <input
                type="number"
                min={1}
                max={3600}
                value={timeout}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Active
            </label>
          </div>
        </div>

        {saveError && <ErrorLine>{saveError}</ErrorLine>}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || Boolean(jsonError)}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {jsonError && (
            <span className="text-sm text-slate-500">
              Fix the JSON above before saving.
            </span>
          )}
          {!jsonError && savedAt && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>
          )}
        </div>
      </section>

      {/* History */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Runs</h2>
          {anyInFlight && (
            <span className="text-sm text-slate-500">Refreshing while a run is active…</span>
          )}
        </div>

        {runs.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500">
            No runs yet. Press <span className="font-medium">Run now</span> to start one.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Started</th>
                  <th className="px-4 py-2.5 font-medium">Duration</th>
                  <th className="px-4 py-2.5 font-medium">Steps</th>
                  <th className="px-4 py-2.5 font-medium">Trigger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() =>
                      router.push(
                        `/dashboard/workspace/${workspaceId}/scenarios/${slug}/runs/${run.id}`
                      )
                    }
                    className="cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3">
                      <RunStatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {run.started_at
                        ? new Date(run.started_at).toLocaleString()
                        : new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {run.duration_ms != null ? `${run.duration_ms} ms` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {run.step_count}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{run.trigger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={showDelete} onClose={() => setShowDelete(false)} title="Delete scenario">
        <p className="text-slate-600 dark:text-slate-300">
          Deleting <span className="font-medium">{scenario.name}</span> also removes its
          run history and any mocks it defines. This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {hint && <p className="mb-1 text-xs text-slate-500">{hint}</p>}
      <div className={hint ? "" : "mt-1"}>{children}</div>
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-red-600 dark:text-red-400">{children}</p>;
}

function UrlCard({
  label,
  hint,
  url,
}: {
  label: string;
  hint: string;
  url: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
        {url && <CopyButton text={url} />}
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <code className="mt-2 block break-all rounded bg-slate-100 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300">
        {url ?? "Not provisioned"}
      </code>
    </div>
  );
}
