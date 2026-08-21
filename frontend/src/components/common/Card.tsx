import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
  glass?: boolean;
  padding?: string;
}

export function Card({
  className,
  children,
  hover = false,
  glass = false,
  padding = "p-6",
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border shadow-sm",
        glass
          ? "bg-white/80 backdrop-blur-xl border-slate-200/40"
          : "bg-white border-slate-200/60",
        hover && "hover:shadow-md hover:border-slate-300 transition-all duration-300",
        padding,
        className
      )}
    >
      {children}
    </div>
  );
}
