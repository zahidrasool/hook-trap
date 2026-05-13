import { cn } from "@/lib/utils";

interface AlertProps {
  type?: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
}

export function Alert({ type = "info", children }: AlertProps) {
  return (
    <div
      className={cn("px-4 py-3 rounded-lg text-sm", {
        "bg-blue-50 text-blue-800": type === "info",
        "bg-green-50 text-green-800": type === "success",
        "bg-yellow-50 text-yellow-800": type === "warning",
        "bg-red-50 text-red-800": type === "error",
      })}
    >
      {children}
    </div>
  );
}
