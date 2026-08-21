"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import type { MockRule, MatchCondition } from "@/types/mock";

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "exists", label: "Exists" },
  { value: "regex", label: "Regex" },
  { value: "gt", label: "Greater Than" },
  { value: "lt", label: "Less Than" },
];

interface ResponseRuleEditorProps {
  rule?: Partial<MockRule>;
  onSave: (rule: Partial<MockRule>) => void;
  onCancel: () => void;
}

export function ResponseRuleEditor({ rule, onSave, onCancel }: ResponseRuleEditorProps) {
  const [name, setName] = useState(rule?.name || "");
  const [priority, setPriority] = useState(rule?.priority ?? 0);
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [conditions, setConditions] = useState<MatchCondition[]>(
    rule?.match_conditions || [{ field: "", operator: "equals", value: "" }]
  );
  const [responseStatus, setResponseStatus] = useState(rule?.response_status ?? 200);
  const [responseBody, setResponseBody] = useState(rule?.response_body || "");
  const [responseHeaders, setResponseHeaders] = useState<Array<{ key: string; value: string }>>(
    rule?.response_headers
      ? Object.entries(rule.response_headers).map(([key, value]) => ({ key, value }))
      : [{ key: "", value: "" }]
  );
  const [responseDelay, setResponseDelay] = useState(rule?.response_delay_ms ?? 0);

  const addCondition = () => {
    setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<MatchCondition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const addHeader = () => {
    setResponseHeaders([...responseHeaders, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setResponseHeaders(responseHeaders.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const headersObj: Record<string, string> = {};
    responseHeaders.forEach(({ key, value }) => {
      if (key.trim()) headersObj[key.trim()] = value;
    });

    onSave({
      ...rule,
      name: name || null,
      priority,
      is_active: isActive,
      match_conditions: conditions.filter((c) => c.field.trim()),
      response_status: responseStatus,
      response_body: responseBody || null,
      response_headers: Object.keys(headersObj).length > 0 ? headersObj : null,
      response_delay_ms: responseDelay,
    });
  };

  const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300";

  return (
    <div className="space-y-6">
      {/* Section: Name & Meta */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500">
            <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Rule Details
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Match admin users"
              className={inputClass}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div className="flex items-end pb-2">
              <button
                onClick={() => setIsActive(!isActive)}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                    isActive ? "bg-indigo-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isActive ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </span>
                <span className="text-slate-600 font-medium">Active</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Conditions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500">
              <path d="M2 3h12l-4 5v4l-4 1V8L2 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Match Conditions
          </h3>
          <button
            onClick={addCondition}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add Condition
          </button>
        </div>
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-slate-50/70 rounded-lg ring-1 ring-inset ring-slate-200/60">
              <input
                type="text"
                value={condition.field}
                onChange={(e) => updateCondition(index, { field: e.target.value })}
                placeholder="e.g., header.Authorization"
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none font-mono placeholder:text-slate-300 placeholder:font-sans"
              />
              <select
                value={condition.operator}
                onChange={(e) => updateCondition(index, { operator: e.target.value })}
                className="px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              {condition.operator !== "exists" && (
                <input
                  type="text"
                  value={condition.value || ""}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
                />
              )}
              {conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(index)}
                  className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section: Response */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500">
            <path d="M14 6l-5 5-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2L9 7 4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Response
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Status Code</label>
            <input
              type="number"
              value={responseStatus}
              onChange={(e) => setResponseStatus(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Delay (ms)</label>
            <input
              type="number"
              value={responseDelay}
              onChange={(e) => setResponseDelay(Number(e.target.value))}
              min={0}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Response Body</label>
          <div className="relative rounded-lg overflow-hidden border border-slate-700/30">
            <div className="absolute top-0 left-0 right-0 h-7 bg-slate-800 flex items-center px-3 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
              <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
              <span className="w-2 h-2 rounded-full bg-slate-600/80"></span>
            </div>
            <textarea
              value={responseBody}
              onChange={(e) => setResponseBody(e.target.value)}
              className="w-full h-32 font-mono text-sm p-3 pt-10 bg-slate-900 text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/40 placeholder:text-slate-600 selection:bg-indigo-500/30"
              placeholder='{"error": "Not found"}'
              spellCheck={false}
            />
          </div>
        </div>

        {/* Headers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600">Response Headers</label>
            <button
              onClick={addHeader}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Add Header
            </button>
          </div>
          <div className="space-y-2">
            {responseHeaders.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => {
                    const updated = [...responseHeaders];
                    updated[index] = { ...updated[index], key: e.target.value };
                    setResponseHeaders(updated);
                  }}
                  placeholder="Header name"
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => {
                    const updated = [...responseHeaders];
                    updated[index] = { ...updated[index], value: e.target.value };
                    setResponseHeaders(updated);
                  }}
                  placeholder="Value"
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
                />
                {responseHeaders.length > 1 && (
                  <button
                    onClick={() => removeHeader(index)}
                    className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Rule</Button>
      </div>
    </div>
  );
}
