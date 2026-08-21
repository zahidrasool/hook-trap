"use client";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="border-b border-slate-200">
      <nav className="flex gap-0 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-base font-medium border-b-2 transition-all duration-200 whitespace-nowrap focus:outline-none",
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-sm transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-indigo-50 text-indigo-600"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
