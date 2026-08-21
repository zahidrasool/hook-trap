"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import type { MockSequence, SequenceStep } from "@/types/mock";

interface SequenceEditorProps {
  sequence?: Partial<MockSequence>;
  onSave: (sequence: Partial<MockSequence>) => void;
  onCancel: () => void;
}

export function SequenceEditor({ sequence, onSave, onCancel }: SequenceEditorProps) {
  const [name, setName] = useState(sequence?.name || "");
  const [isActive, setIsActive] = useState(sequence?.is_active ?? true);
  const [loop, setLoop] = useState(sequence?.loop ?? false);
  const [steps, setSteps] = useState<Array<Omit<SequenceStep, "id">>>(
    sequence?.steps?.map((s) => ({
      step_order: s.step_order,
      response_status: s.response_status,
      response_headers: s.response_headers,
      response_body: s.response_body,
      response_delay_ms: s.response_delay_ms,
    })) || [
      {
        step_order: 1,
        response_status: 200,
        response_headers: null,
        response_body: "",
        response_delay_ms: 0,
      },
    ]
  );

  const addStep = () => {
    setSteps([
      ...steps,
      {
        step_order: steps.length + 1,
        response_status: 200,
        response_headers: null,
        response_body: "",
        response_delay_ms: 0,
      },
    ]);
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index);
    // Re-number steps
    setSteps(updated.map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const updateStep = (index: number, updates: Partial<Omit<SequenceStep, "id">>) => {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const handleSave = () => {
    onSave({
      ...sequence,
      name: name || null,
      is_active: isActive,
      loop,
      steps: steps as SequenceStep[],
    });
  };

  const inputClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300";

  return (
    <div className="space-y-6">
      {/* Name & Options */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500">
            <path d="M4 6h8M4 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="6" cy="6" r="1" fill="currentColor"/>
            <circle cx="10" cy="10" r="1" fill="currentColor"/>
          </svg>
          Sequence Details
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Sequence Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pagination sequence"
              className={`w-full ${inputClass}`}
            />
          </div>
          <div className="flex items-end gap-5 pb-1">
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
            <button
              onClick={() => setLoop(!loop)}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                  loop ? "bg-violet-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    loop ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </span>
              <span className="text-slate-600 font-medium">Loop</span>
            </button>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500">
              <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Steps
          </h3>
        </div>
        <div className="rounded-xl border border-slate-200/60 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/60">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-16">
                  #
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Body
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">
                  Delay
                </th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {steps.map((step, index) => (
                <tr key={index} className="hover:bg-slate-50/50 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-slate-500 text-xs font-medium">
                      {step.step_order}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={step.response_status}
                      onChange={(e) =>
                        updateStep(index, { response_status: Number(e.target.value) })
                      }
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={step.response_body || ""}
                      onChange={(e) =>
                        updateStep(index, { response_body: e.target.value || null })
                      }
                      placeholder='{"message": "Step response"}'
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-sm font-mono bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300 placeholder:font-sans"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={step.response_delay_ms}
                      onChange={(e) =>
                        updateStep(index, { response_delay_ms: Number(e.target.value) })
                      }
                      min={0}
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {steps.length > 1 && (
                      <button
                        onClick={() => removeStep(index)}
                        className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Add step button at bottom of table */}
          <div className="border-t border-slate-200/60 bg-slate-50/50 px-4 py-2.5">
            <button
              onClick={addStep}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Add Step
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Sequence</Button>
      </div>
    </div>
  );
}
