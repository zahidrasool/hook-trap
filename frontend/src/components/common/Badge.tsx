import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "primary" | "success" | "warning" | "error" | "info";
  dot?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  default: "bg-slate-50 text-slate-700 ring-1 ring-slate-600/20",
  primary: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  error: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
};

const dotColors: Record<string, string> = {
  default: "bg-slate-500",
  primary: "bg-indigo-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
};

export function Badge({ variant = "default", dot = false, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
        variantStyles[variant]
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
