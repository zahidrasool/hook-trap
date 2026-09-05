"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { RunStatusBadge } from "@/components/scenario/RunStatusBadge";
import {
  isTerminal,
  RUN_STATUS_HELP,
  type AssertionResult,
  type Run,
  type StepResult,
} from "@/types/scenario";

export default function RunDetailPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const slug = params.slug as string;
  const runId = params.runId as string;

  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchRun = useCallback(async () => {
    try {
      const data = await api.get(`/api/v1/workspaces/${workspaceId}/runs/${runId}`);
      setRun(data);
      return data as Run;
    } catch (err: any) {
      setError(err.message || "Could not load this run");
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceId, runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Live until the run reaches a terminal status, then stop for good. Step
  // results are committed as each step finishes, so this fills in progressively
  // rather than staying blank until the end.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const live = run != null && !isTerminal(run.status);

  useEffect(() => {
    if (!live) {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      return;
    }
    if (timer.current) return;
    timer.current = setInterval(fetchRun, 1500);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [live, fetchRun]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/api/v1/workspaces/${workspaceId}/runs/${runId}/cancel`);
      await fetchRun();
    } catch (err: any) {
      setError(err.message || "Could not cancel");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium text-red-500">{error || "Run not found"}</p>
        <Link
          href={`/dashboard/workspace/${workspaceId}/scenarios/${slug}`}
          className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 underline"
        >
          Back to the scenario
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <Link
        href={`/dashboard/workspace/${workspaceId}/scenarios/${slug}`}
        className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        ← {slug}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Run</h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {RUN_STATUS_HELP[run.status]}
          </p>
        </div>
        {live && (
          <Button variant="secondary" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? "Cancelling..." : "Cancel run"}
          </Button>
        )}
      </div>

      {run.error && (
        <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {run.error}
        </p>
      )}

      <dl className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Trigger" value={run.trigger} />
        <Stat
          label="Started"
          value={run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
        />
        <Stat
          label="Duration"
          value={run.duration_ms != null ? `${run.duration_ms} ms` : "—"}
        />
        <Stat label="Steps" value={String(run.step_results.length)} />
      </dl>

      {Object.keys(run.variables ?? {}).length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Variables this run started with
          </h2>
          <Json value={run.variables} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900 dark:text-white">Steps</h2>
        {run.step_results.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500">
            {live
              ? "Waiting for the first step to finish…"
              : "This run recorded no steps."}
          </p>
        ) : (
          <ol className="mt-4 space-y-4">
            {run.step_results.map((step) => (
              <StepCard key={step.step_index} step={step} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function StepCard({ step }: { step: StepResult }) {
  const [open, setOpen] = useState(step.status !== "passed");

  const took =
    step.started_at && step.finished_at
      ? `${new Date(step.finished_at).getTime() - new Date(step.started_at).getTime()} ms`
      : null;

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-900">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span className="w-7 text-sm font-medium text-slate-400">
          {step.step_index + 1}
        </span>
        <code className="text-sm font-medium text-slate-900 dark:text-white">
          {step.step_type}
        </code>
        <RunStatusBadge status={step.status} />
        {took && <span className="text-sm text-slate-400">{took}</span>}
        <svg
          className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-200/60 dark:border-slate-700 px-5 py-4">
          {step.error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {step.error}
            </p>
          )}

          {step.assertions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Assertions
              </h3>
              <ul className="mt-2 space-y-1.5">
                {step.assertions.map((assertion, index) => (
                  <AssertionRow key={index} assertion={assertion} />
                ))}
              </ul>
            </div>
          )}

          {Object.keys(step.captured ?? {}).length > 0 && (
            <Labelled title="Captured">
              <Json value={step.captured} />
            </Labelled>
          )}
          {step.matched_id && (
            <Labelled title="Matched">
              <code className="text-xs text-slate-600 dark:text-slate-300">
                {step.matched_id}
              </code>
            </Labelled>
          )}
          {step.request && (
            <Labelled title="Request">
              <Json value={step.request} />
            </Labelled>
          )}
          {step.response && (
            <Labelled title="Response">
              <Json value={step.response} />
            </Labelled>
          )}
        </div>
      )}
    </li>
  );
}

function AssertionRow({ assertion }: { assertion: AssertionResult }) {
  const passed = assertion.passed === true;
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        className={passed ? "mt-0.5 text-emerald-500" : "mt-0.5 text-red-500"}
        aria-hidden="true"
      >
        {passed ? "✓" : "✕"}
      </span>
      <div className="min-w-0">
        <code className="text-slate-800 dark:text-slate-200">{assertion.assertion}</code>
        {/* Expected vs actual only on failure — on a passing assertion they
            agree by definition, and printing both would be noise. */}
        {!passed && (
          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
            expected <code className="text-slate-700 dark:text-slate-300">
              {formatValue(assertion.expected)}
            </code>
            , got <code className="text-slate-700 dark:text-slate-300">
              {formatValue(assertion.actual)}
            </code>
          </p>
        )}
      </div>
    </li>
  );
}

/** Render a value the way it would be written, so `"2"` and `2` stay distinct —
 *  a type mismatch is one of the commonest reasons an assertion surprises
 *  someone, and String() would hide it. */
function formatValue(value: unknown): string {
  if (value === undefined) return "nothing";
  return JSON.stringify(value) ?? String(value);
}

function Labelled({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
