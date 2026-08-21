import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:brightness-110 shadow-lg shadow-indigo-500/25 active:shadow-md":
            variant === "primary",
          "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200":
            variant === "secondary",
          "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-200":
            variant === "danger",
          "bg-transparent text-slate-600 hover:bg-slate-100":
            variant === "ghost",
          "h-9 px-4 text-sm gap-1.5": size === "sm",
          "h-10 px-5 text-base gap-2": size === "md",
          "h-12 px-7 text-lg gap-2.5": size === "lg",
        },
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <Spinner size={size === "lg" ? "md" : "sm"} />
      )}
      {children}
    </button>
  );
}
