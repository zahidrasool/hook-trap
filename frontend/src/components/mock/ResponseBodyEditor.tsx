"use client";

import { useRef } from "react";
import { TemplateHelperPicker } from "./TemplateHelperPicker";

interface ResponseBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ResponseBodyEditor({ value, onChange }: ResponseBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertTemplate = (template: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newValue = before + template + after;
    onChange(newValue);

    // Restore cursor position after template
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + template.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
    } catch {
      // Not valid JSON, leave as-is
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-base font-medium text-slate-700">Response Body</label>
          <button
            onClick={handleFormat}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4h8M3 7h5M3 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Format JSON
          </button>
        </div>
        <div className="relative rounded-lg overflow-hidden border border-slate-700/30 shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-8 bg-slate-800 flex items-center px-3 gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600/80"></span>
            <span className="ml-3 text-[10px] text-slate-500 font-mono uppercase tracking-wider">json</span>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-72 sm:h-80 font-mono text-base p-4 pt-12 bg-slate-900 text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/40 placeholder:text-slate-600 selection:bg-indigo-500/30"
            placeholder='{"message": "Hello, world!"}'
            spellCheck={false}
          />
        </div>
      </div>
      <div className="w-full lg:w-60 lg:shrink-0">
        <TemplateHelperPicker onInsert={handleInsertTemplate} />
      </div>
    </div>
  );
}
