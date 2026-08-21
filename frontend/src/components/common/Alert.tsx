"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AlertProps {
  type?: "info" | "success" | "warning" | "error";
  dismissible?: boolean;
  children: React.ReactNode;
}

const alertStyles: Record<string, string> = {
  info: "border-l-blue-500 bg-blue-50 text-blue-800",
  success: "border-l-emerald-500 bg-emerald-50 text-emerald-800",
  warning: "border-l-amber-500 bg-amber-50 text-amber-800",
  error: "border-l-red-500 bg-red-50 text-red-800",
};

const iconColors: Record<string, string> = {
  info: "text-blue-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v4M10 7h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3l8 14H2L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 9v3M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8l4 4M12 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const icons: Record<string, React.FC<{ className?: string }>> = {
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

export function Alert({ type = "info", dismissible = false, children }: AlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const Icon = icons[type];

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-xl border-l-4 px-4 py-3 text-base",
        alertStyles[type]
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColors[type])} />
      <div className="flex-1">{children}</div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-md p-0.5 opacity-60 transition-all duration-200 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
