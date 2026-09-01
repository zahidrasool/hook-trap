interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "light" | "dark";
  className?: string;
}

const sizes = {
  sm: { icon: "h-6 w-6", text: "text-lg", lane: "h-2.5 w-5" },
  md: { icon: "h-9 w-9", text: "text-2xl", lane: "h-3.5 w-7" },
  lg: { icon: "h-16 w-16", text: "text-4xl", lane: "h-6 w-12" },
};

export function MockLaneLogo({
  size = "md",
  showText = true,
  variant = "dark",
  className = "",
}: LogoProps) {
  const s = sizes[size];
  const textColor =
    variant === "dark" ? "text-white" : "text-slate-900";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`${s.icon} relative flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/20`}
      >
        {/* Road / lane icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[60%] w-[60%] text-white"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Two converging lanes */}
          <path
            d="M7 4L4 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M17 4L20 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Center dashes */}
          <path
            d="M12 5V8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 11V14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 17V20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showText && (
        <span className={`${s.text} font-bold tracking-tight ${textColor}`}>
          Mock<span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Lane</span>
        </span>
      )}
    </span>
  );
}

export function MockLaneIcon({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`${className} relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/20`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[60%] w-[60%] text-white"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M7 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M17 4L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 11V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
