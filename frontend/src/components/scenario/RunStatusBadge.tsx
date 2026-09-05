"use client";

import { RUN_STATUS_HELP, RUN_STATUS_STYLES, type RunStatus } from "@/types/scenario";

/** One badge, used everywhere a status appears, so the colours cannot diverge.
 *
 *  `failed` and `error` get different colours deliberately. They are different
 *  outcomes — an assertion that did not hold versus a step the engine could not
 *  run — and a user reading a red badge needs to know which of those happened
 *  before deciding whether to look at their code or ours.
 */
export function RunStatusBadge({
  status,
  className = "",
}: {
  status: RunStatus;
  className?: string;
}) {
  const style =
    RUN_STATUS_STYLES[status] ??
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      title={RUN_STATUS_HELP[status] ?? status}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {status}
    </span>
  );
}
