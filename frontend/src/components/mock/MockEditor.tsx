"use client";

import { useState, useCallback } from "react";
import { Tabs } from "@/components/common/Tabs";
import { Button } from "@/components/common/Button";
import { Alert } from "@/components/common/Alert";
import { ResponseBodyEditor } from "./ResponseBodyEditor";
import { ResponseRuleEditor } from "./ResponseRuleEditor";
import { SequenceEditor } from "./SequenceEditor";
import { MockRequestLog } from "./MockRequestLog";
import { ContractValidator } from "./ContractValidator";
import { api } from "@/lib/api";
import type { MockEndpoint, MockRule, MockSequence, MockRequestLog as MockRequestLogType } from "@/types/mock";
import { useEffect } from "react";

const STATUS_CODES = [200, 201, 204, 301, 302, 400, 401, 403, 404, 405, 409, 422, 429, 500, 502, 503];

interface MockEditorProps {
  mock: MockEndpoint;
  workspaceId: string;
  onUpdate: (mock: MockEndpoint) => void;
}

export function MockEditor({ mock, workspaceId, onUpdate }: MockEditorProps) {
  const [activeTab, setActiveTab] = useState("response");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Response tab state
  const [responseStatus, setResponseStatus] = useState(mock.response_status);
  const [responseBody, setResponseBody] = useState(mock.response_body || "");
  const [responseHeaders, setResponseHeaders] = useState<Array<{ key: string; value: string }>>(
    mock.response_headers
      ? Object.entries(mock.response_headers).map(([key, value]) => ({ key, value }))
      : [{ key: "Content-Type", value: "application/json" }]
  );
  const [responseDelay, setResponseDelay] = useState(mock.response_delay_ms);
  const [errorRate, setErrorRate] = useState(mock.error_rate);
  const [errorStatus, setErrorStatus] = useState(mock.error_status);
  const [errorBody, setErrorBody] = useState(mock.error_body || "");
  const [isImmutable, setIsImmutable] = useState(mock.is_immutable ?? false);

  // Static Data state
  const [staticData, setStaticData] = useState<string>(
    mock.static_data ? JSON.stringify(mock.static_data, null, 2) : ""
  );
  const [staticDataError, setStaticDataError] = useState<string | null>(null);

  // Rules tab state
  const [rules, setRules] = useState<MockRule[]>(mock.rules || []);
  const [editingRule, setEditingRule] = useState<Partial<MockRule> | null>(null);
  const [isNewRule, setIsNewRule] = useState(false);

  // Sequences tab state
  const [sequences, setSequences] = useState<MockSequence[]>(mock.sequences || []);
  const [editingSequence, setEditingSequence] = useState<Partial<MockSequence> | null>(null);
  const [isNewSequence, setIsNewSequence] = useState(false);

  // Logs tab state
  const [logs, setLogs] = useState<MockRequestLogType[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await api.get(
        `/api/v1/workspaces/${workspaceId}/mocks/${mock.id}/logs`
      );
      setLogs(Array.isArray(data) ? data : data.items || []);
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  }, [workspaceId, mock.id]);

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  const validateStaticData = (value: string): boolean => {
    if (!value.trim()) {
      setStaticDataError(null);
      return true;
    }
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        setStaticDataError("Static data must be a JSON array");
        return false;
      }
      setStaticDataError(null);
      return true;
    } catch {
      setStaticDataError("Invalid JSON syntax");
      return false;
    }
  };

  const handleSaveResponse = async () => {
    setSaving(true);
    setSaveMessage(null);

    // Validate static data before saving
    if (staticData.trim() && !validateStaticData(staticData)) {
      setSaving(false);
      setSaveMessage({ type: "error", text: "Static data contains invalid JSON." });
      return;
    }

    try {
      const headersObj: Record<string, string> = {};
      responseHeaders.forEach(({ key, value }) => {
        if (key.trim()) headersObj[key.trim()] = value;
      });

      let parsedStaticData: any[] | null = null;
      if (staticData.trim()) {
        try {
          parsedStaticData = JSON.parse(staticData);
        } catch {
          // already validated above
        }
      }

      const updated = await api.patch(`/api/v1/workspaces/${workspaceId}/mocks/${mock.id}`, {
        response_status: responseStatus,
        response_body: responseBody || null,
        response_headers: Object.keys(headersObj).length > 0 ? headersObj : null,
        response_delay_ms: responseDelay,
        error_rate: errorRate,
        error_status: errorStatus,
        error_body: errorBody || null,
        is_immutable: isImmutable,
        static_data: parsedStaticData,
      });
      onUpdate(updated);
      setSaveMessage({ type: "success", text: "Response saved successfully." });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRule = async (ruleData: Partial<MockRule>) => {
    try {
      if (isNewRule) {
        const created = await api.post(
          `/api/v1/workspaces/${workspaceId}/mocks/${mock.id}/rules`,
          ruleData
        );
        setRules([...rules, created]);
      } else {
        const updated = await api.patch(
          `/api/v1/workspaces/${workspaceId}/mocks/${mock.id}/rules/${ruleData.id}`,
          ruleData
        );
        setRules(rules.map((r) => (r.id === updated.id ? updated : r)));
      }
      setEditingRule(null);
      setIsNewRule(false);
    } catch {
      // error handling
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await api.delete(
        `/api/v1/workspaces/${workspaceId}/mocks/${mock.id}/rules/${ruleId}`
      );
      setRules(rules.filter((r) => r.id !== ruleId));
    } catch {
      // error handling
    }
  };

  const handleSaveSequence = async (seqData: Partial<MockSequence>) => {
    try {
      if (isNewSequence) {
        const created = await api.post(
          `/api/v1/workspaces/${workspaceId}/mocks/${mock.id}/sequences`,
          seqData
        );
        setSequences([...sequences, created]);
      } else {
        const updated = await api.patch(
          `/api/v1/workspaces/${workspaceId}/mocks/${mock.id}/sequences/${seqData.id}`,
          seqData
        );
        setSequences(sequences.map((s) => (s.id === updated.id ? updated : s)));
      }
      setEditingSequence(null);
      setIsNewSequence(false);
    } catch {
      // error handling
    }
  };

  const handleDeleteSequence = async (seqId: string) => {
    try {
      await api.delete(
        `/api/v1/workspaces/${workspaceId}/mocks/${mock.id}/sequences/${seqId}`
      );
      setSequences(sequences.filter((s) => s.id !== seqId));
    } catch {
      // error handling
    }
  };

  const addHeader = () => {
    setResponseHeaders([...responseHeaders, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setResponseHeaders(responseHeaders.filter((_, i) => i !== index));
  };

  const tabs = [
    { id: "response", label: "Response" },
    { id: "static-data", label: "Static Data" },
    { id: "rules", label: "Rules", count: rules.length },
    { id: "sequences", label: "Sequences", count: sequences.length },
    { id: "logs", label: "Logs" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 pt-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="p-6 sm:p-8">
        {/* Response Tab */}
        {activeTab === "response" && (
          <div className="space-y-6">
            {saveMessage && (
              <Alert type={saveMessage.type === "success" ? "success" : "error"} dismissible>
                {saveMessage.text}
              </Alert>
            )}

            {/* Immutable Mode Toggle */}
            <div className="flex items-center justify-between py-3 px-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div>
                <span className="text-base font-medium text-amber-900">Immutable Mode</span>
                <p className="text-sm text-amber-600">When enabled, only GET requests are allowed (POST/PUT/PATCH/DELETE return 405)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsImmutable(!isImmutable)}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 ${isImmutable ? 'bg-amber-500' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${isImmutable ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
              </button>
            </div>

            {/* Status Code */}
            <div>
              <label className="block text-base font-medium text-slate-700 mb-1.5">
                Status Code
              </label>
              <select
                value={responseStatus}
                onChange={(e) => setResponseStatus(Number(e.target.value))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-base bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none"
              >
                {STATUS_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            {/* Response Body */}
            <ResponseBodyEditor value={responseBody} onChange={setResponseBody} />

            {/* Response Headers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-base font-medium text-slate-700">Response Headers</label>
                <button
                  onClick={addHeader}
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-base shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
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
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-base shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
                    />
                    {responseHeaders.length > 1 && (
                      <button
                        onClick={() => removeHeader(index)}
                        className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
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

            {/* Delay Slider */}
            <div>
              <label className="block text-base font-medium text-slate-700 mb-1.5">
                Response Delay
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={50}
                  value={responseDelay}
                  onChange={(e) => setResponseDelay(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 h-1.5"
                />
                <span className="text-sm font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md ring-1 ring-inset ring-slate-200/80 min-w-[72px] text-center">
                  {responseDelay}ms
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1 px-0.5">
                <span>0ms</span>
                <span>5000ms</span>
              </div>
            </div>

            {/* Error Rate Slider */}
            <div>
              <label className="block text-base font-medium text-slate-700 mb-1.5">
                Error Rate
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={errorRate}
                  onChange={(e) => setErrorRate(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 h-1.5"
                />
                <span className="text-sm font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md ring-1 ring-inset ring-slate-200/80 min-w-[52px] text-center">
                  {errorRate}%
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1 px-0.5">
                <span>0%</span>
                <span>100%</span>
              </div>
              {errorRate > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-red-50/50 ring-1 ring-inset ring-red-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Error Status</label>
                    <select
                      value={errorStatus}
                      onChange={(e) => setErrorStatus(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none"
                    >
                      {[400, 401, 403, 404, 500, 502, 503].map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Error Body</label>
                    <input
                      type="text"
                      value={errorBody}
                      onChange={(e) => setErrorBody(e.target.value)}
                      placeholder='{"error": "Internal server error"}'
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-mono bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Contract Validation */}
            <ContractValidator workspaceId={workspaceId} mockId={mock.id} />

            {/* Save */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button onClick={handleSaveResponse} disabled={saving} loading={saving}>
                {saving ? "Saving..." : "Save Response"}
              </Button>
            </div>
          </div>
        )}

        {/* Static Data Tab */}
        {activeTab === "static-data" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200/60 rounded-lg">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500 mt-0.5 shrink-0">
                <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9 5.5v4M9 12.5h.007" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p className="text-base text-indigo-700 leading-relaxed">
                Define a static JSON array. GET requests return the full array, GET with <code className="bg-indigo-100 px-1 py-0.5 rounded text-xs font-mono">/:id</code> returns a matching item by <code className="bg-indigo-100 px-1 py-0.5 rounded text-xs font-mono">id</code> field.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-base font-medium text-slate-700">Static Data (JSON Array)</label>
                <button
                  type="button"
                  onClick={() => {
                    setStaticData("");
                    setStaticDataError(null);
                  }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-700 transition-colors duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Clear
                </button>
              </div>
              <textarea
                value={staticData}
                onChange={(e) => setStaticData(e.target.value)}
                onBlur={() => validateStaticData(staticData)}
                rows={16}
                placeholder={`[\n  {\n    "id": 1,\n    "name": "Alice",\n    "email": "alice@example.com"\n  },\n  {\n    "id": 2,\n    "name": "Bob",\n    "email": "bob@example.com"\n  }\n]`}
                className={`w-full px-4 py-3 bg-slate-900 text-emerald-400 border rounded-lg text-base font-mono shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-600 resize-y ${
                  staticDataError ? "border-red-400" : "border-slate-700"
                }`}
              />
              {staticDataError && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M6 3.5v3M6 8.5h.005" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {staticDataError}
                </p>
              )}
            </div>

            {/* Save */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button onClick={handleSaveResponse} disabled={saving} loading={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === "rules" && (
          <div>
            {editingRule ? (
              <ResponseRuleEditor
                rule={editingRule}
                onSave={handleSaveRule}
                onCancel={() => {
                  setEditingRule(null);
                  setIsNewRule(false);
                }}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-base text-slate-500">
                    Rules let you return different responses based on request conditions.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingRule({});
                      setIsNewRule(true);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Add Rule
                  </Button>
                </div>

                {rules.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v6m12-4v4m0 0H9m12 0v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9m6 0H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-slate-600 mb-1">No rules yet</p>
                    <p className="text-base text-slate-400 max-w-sm mx-auto">
                      Create a rule to match specific request conditions and return custom responses.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="bg-white border border-slate-200/60 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                rule.is_active ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            />
                            <span className="font-medium text-base text-slate-800">
                              {rule.name || "Unnamed Rule"}
                            </span>
                            <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded ring-1 ring-inset ring-slate-200/80">
                              Priority {rule.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                            <span className="text-sm text-slate-500 mr-2">
                              {rule.match_conditions.length} condition{rule.match_conditions.length !== 1 ? "s" : ""}
                            </span>
                            <span className="text-sm px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80 font-mono">
                              {rule.response_status}
                            </span>
                            <button
                              onClick={() => {
                                setEditingRule(rule);
                                setIsNewRule(false);
                              }}
                              className="text-sm font-medium text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-50 transition-all duration-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-sm font-medium text-red-400 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-all duration-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {rule.match_conditions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {rule.match_conditions.map((c, i) => (
                              <span
                                key={i}
                                className="text-sm bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md font-mono ring-1 ring-inset ring-slate-200/80"
                              >
                                {c.field} {c.operator} {c.value || ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sequences Tab */}
        {activeTab === "sequences" && (
          <div>
            {editingSequence ? (
              <SequenceEditor
                sequence={editingSequence}
                onSave={handleSaveSequence}
                onCancel={() => {
                  setEditingSequence(null);
                  setIsNewSequence(false);
                }}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-base text-slate-500">
                    Sequences return different responses on successive calls.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingSequence({});
                      setIsNewSequence(true);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Add Sequence
                  </Button>
                </div>

                {sequences.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="8" cy="6" r="1" fill="currentColor"/>
                        <circle cx="8" cy="12" r="1" fill="currentColor"/>
                        <circle cx="8" cy="18" r="1" fill="currentColor"/>
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-slate-600 mb-1">No sequences yet</p>
                    <p className="text-base text-slate-400 max-w-sm mx-auto">
                      Create a sequence to return different responses on each successive request.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sequences.map((seq) => (
                      <div
                        key={seq.id}
                        className="bg-white border border-slate-200/60 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                seq.is_active ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            />
                            <span className="font-medium text-base text-slate-800">
                              {seq.name || "Unnamed Sequence"}
                            </span>
                            {seq.loop && (
                              <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-md ring-1 ring-inset ring-violet-200/80 font-medium">
                                Loop
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                            <span className="text-sm text-slate-500 mr-2">
                              {seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}
                            </span>
                            <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded ring-1 ring-inset ring-slate-200/80">
                              Current: #{seq.current_step}
                            </span>
                            <button
                              onClick={() => {
                                setEditingSequence(seq);
                                setIsNewSequence(false);
                              }}
                              className="text-sm font-medium text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-50 transition-all duration-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSequence(seq.id)}
                              className="text-sm font-medium text-red-400 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-all duration-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-1.5">
                          {seq.steps.map((step, i) => (
                            <span
                              key={step.id || i}
                              className={`text-sm px-2.5 py-0.5 rounded-md font-mono transition-colors duration-200 ${
                                i === seq.current_step
                                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 font-medium"
                                  : "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200/80"
                              }`}
                            >
                              {step.response_status}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-base text-slate-500">Recent requests to this mock endpoint.</p>
              <Button size="sm" variant="secondary" onClick={fetchLogs}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.5 7a5.5 5.5 0 019.37-3.9M12.5 7a5.5 5.5 0 01-9.37 3.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M11 1v3h-3M3 13v-3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Refresh
              </Button>
            </div>
            <MockRequestLog logs={logs} loading={logsLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
