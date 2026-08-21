"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { MockEndpointCard } from "@/components/mock/MockEndpointCard";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { Dialog } from "@/components/common/Dialog";
import { YamlConfigImport } from "@/components/mock/YamlConfigImport";
import type { MockEndpoint } from "@/types/mock";

const HTTP_METHODS = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export default function MocksPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [mocks, setMocks] = useState<MockEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showYamlImport, setShowYamlImport] = useState(false);

  // Create form state
  const [newPath, setNewPath] = useState("/");
  const [newMethod, setNewMethod] = useState("GET");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchMocks = () => {
    api
      .get(`/api/v1/workspaces/${workspaceId}/mocks`)
      .then((data) => setMocks(Array.isArray(data) ? data : data.data || data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const filteredMocks = useMemo(() => {
    return mocks.filter((mock) => {
      if (methodFilter !== "ALL" && mock.method.toUpperCase() !== methodFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          mock.path.toLowerCase().includes(q) ||
          (mock.name && mock.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [mocks, methodFilter, searchQuery]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await api.post(`/api/v1/workspaces/${workspaceId}/mocks`, {
        path: newPath,
        method: newMethod,
        name: newName || null,
      });
      setShowCreateModal(false);
      setNewPath("/");
      setNewMethod("GET");
      setNewName("");
      router.push(`/dashboard/workspace/${workspaceId}/mocks/${created.id}`);
    } catch {
      // error handling
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = (id: string, active: boolean) => {
    setMocks(mocks.map((m) => (m.id === id ? { ...m, is_active: active } : m)));
  };

  const handleYamlImportSuccess = () => {
    fetchMocks();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mock Endpoints</h1>
          <p className="text-base text-slate-500 mt-2">Create and manage mock API responses</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => setShowYamlImport(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-base transition-all duration-200 shadow-sm"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-violet-500">
              <path d="M3 3.5h9M3 7h6M3 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M11.5 8l-2 3.5 3.5-1L11.5 8z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="hidden sm:inline">YAML</span> Import
          </button>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.5 3v9M3 7.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="hidden sm:inline">New</span> Mock
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by path or name..."
            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-base bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
          />
        </div>
        <div className="relative">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="appearance-none px-4 pr-9 py-3 border border-slate-200 rounded-lg text-base bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none font-medium text-slate-600 cursor-pointer"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m === "ALL" ? "All Methods" : m}
              </option>
            ))}
          </select>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Mock list */}
      {filteredMocks.length === 0 ? (
        <div className="text-center py-20">
          {mocks.length === 0 ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mb-5">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M4 12h24M10 6v6M22 6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 18h8M12 22h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-xl font-semibold text-slate-700 mb-2">No mock endpoints yet</p>
              <p className="text-base text-slate-400 mb-6 max-w-md mx-auto">
                Create your first mock endpoint to start simulating API responses. Define paths, set response bodies, and test your integrations.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowYamlImport(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-base transition-all duration-200 shadow-sm"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-violet-500">
                    <path d="M3 3.5h9M3 7h6M3 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <path d="M11.5 8l-2 3.5 3.5-1L11.5 8z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Import YAML
                </button>
                <Button onClick={() => setShowCreateModal(true)}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.5 3v9M3 7.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Create Mock Endpoint
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-base text-slate-500">No mocks match your filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filteredMocks.map((mock) => (
            <MockEndpointCard
              key={mock.id}
              mock={mock}
              workspaceId={workspaceId}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Create Mock Modal */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Mock Endpoint"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Name (optional)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., List Users"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-base bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Method</label>
              <div className="relative">
                <select
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value)}
                  className="w-full appearance-none px-4 py-3 border border-slate-200 rounded-lg text-base bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none font-semibold cursor-pointer"
                >
                  {HTTP_METHODS.filter((m) => m !== "ALL").map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Path</label>
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/api/users"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-base font-mono bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200 outline-none placeholder:text-slate-300"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newPath.trim()} loading={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* YAML Import Modal */}
      <YamlConfigImport
        workspaceId={workspaceId}
        isOpen={showYamlImport}
        onClose={() => setShowYamlImport(false)}
        onSuccess={handleYamlImportSuccess}
      />
    </div>
  );
}
