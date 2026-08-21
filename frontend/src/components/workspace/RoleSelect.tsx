"use client";

interface RoleSelectProps {
  value: string;
  onChange: (role: string) => void;
}

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer", dotColor: "bg-slate-400" },
  { value: "editor", label: "Editor", dotColor: "bg-blue-500" },
  { value: "admin", label: "Admin", dotColor: "bg-violet-500" },
];

export function RoleSelect({ value, onChange }: RoleSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-4 pr-9 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all cursor-pointer"
      >
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
