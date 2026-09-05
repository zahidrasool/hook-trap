// Mirrors backend/app/schemas/scenario.py and scenario_run.py. Steps are
// deliberately `unknown[]` rather than a discriminated union: the engine
// validates step shapes and reports precise errors per step, and duplicating
// that union here would mean two definitions of "a valid step" that drift.

export interface Scenario {
  id: string;
  workspace_id: string;
  short_id: string;
  name: string;
  slug: string;
  description: string | null;
  steps: unknown[];
  variables: Record<string, unknown>;
  timeout_seconds: number;
  is_active: boolean;
  scenario_url: string;
  capture_url: string | null;
  created_at: string;
}

export interface ScenarioListResponse {
  scenarios: Scenario[];
  total: number;
}

export interface StepResult {
  step_index: number;
  step_type: string;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  assertions: AssertionResult[];
  captured: Record<string, unknown>;
  error: string | null;
  matched_id: string | null;
}

// Mirrors assertions.evaluate_all: {assertion, passed, expected, actual}.
// `expected`/`actual` are what make a failure diagnosable — without them the
// UI can say an assertion failed but not why, which is the whole value.
export interface AssertionResult {
  assertion: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
}

export interface Run {
  id: string;
  scenario_id: string;
  status: RunStatus;
  trigger: string;
  variables: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
  step_results: StepResult[];
}

export interface RunSummary {
  id: string;
  scenario_id: string;
  status: RunStatus;
  trigger: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
  step_count: number;
}

export interface RunListResponse {
  runs: RunSummary[];
  total: number;
}

// "failed" and "error" are distinct on purpose and must stay distinct in the
// UI: `failed` is the customer's assertion not holding — a real test result —
// while `error` is the engine unable to run the step at all. Collapsing them
// would tell someone their API is broken when in fact ours is.
export type RunStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "error"
  | "timeout"
  | "cancelled"
  | "skipped";

export const RUN_STATUS_STYLES: Record<RunStatus, string> = {
  pending:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  running:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  passed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  error:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  timeout:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  cancelled:
    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  skipped:
    "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
};

export const TERMINAL_STATUSES: RunStatus[] = [
  "passed",
  "failed",
  "error",
  "timeout",
  "cancelled",
];

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** What each status means, in the words a user needs rather than ours. */
export const RUN_STATUS_HELP: Record<RunStatus, string> = {
  pending: "Queued. Runs in this workspace execute one at a time.",
  running: "Executing now.",
  passed: "Every step ran and every assertion held.",
  failed: "An assertion did not hold — this is a test result, not a fault.",
  error: "A step could not be executed at all. This one is on the engine.",
  timeout: "The run hit its time limit before finishing.",
  cancelled: "Stopped before it finished.",
  skipped: "Not reached, because an earlier step halted the run.",
};
