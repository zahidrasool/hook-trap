import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-indigo-500 border-t-transparent",
        sizeClasses[size]
      )}
    />
  );
}
