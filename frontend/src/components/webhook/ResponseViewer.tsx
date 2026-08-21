"use client";

interface ResponseViewerProps {
  statusCode?: number;
  body?: string;
}

export function ResponseViewer({ statusCode, body }: ResponseViewerProps) {
  if (!statusCode && !body) return null;

  let formatted = body || "";
  try {
    formatted = JSON.stringify(JSON.parse(formatted), null, 2);
  } catch {}

  const statusColor =
    statusCode && statusCode >= 400
      ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
      : statusCode && statusCode >= 300
      ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
      : "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20";

  return (
    <div>
      {statusCode && (
        <div className="mb-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tabular-nums ${statusColor}`}>
            {statusCode}
          </span>
        </div>
      )}
      {body && (
        <pre className="bg-slate-950 text-slate-100 p-5 rounded-xl overflow-auto text-sm font-mono max-h-96 leading-relaxed selection:bg-indigo-500/30">
          {formatted}
        </pre>
      )}
    </div>
  );
}
