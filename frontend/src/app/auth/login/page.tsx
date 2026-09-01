"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <PublicHeader />
      <div className="flex-1 flex items-center justify-center py-12">{children}</div>
      <PublicFooter />
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle callback: store token and redirect to dashboard
  useEffect(() => {
    const isCallback = searchParams.get("callback");
    const token = searchParams.get("token");

    if (isCallback && token) {
      localStorage.setItem("session_token", token);
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post("/api/v1/auth/magic-link", { email });
      setSent(true);
    } catch (err) {
      setError("Failed to send magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Shell>
        <div className="max-w-lg w-full mx-4 p-10 sm:p-12 bg-white dark:bg-slate-900 rounded-2xl shadow-xl text-center">
          {/* Checkmark icon */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Check your inbox</h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-4">
            We sent a magic link to{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span>
          </p>
          <p className="text-base text-slate-400">
            Click the link in your email to sign in. The link expires in 24 hours.
          </p>

          <button
            onClick={() => setSent(false)}
            className="mt-8 text-base text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
          >
            Use a different email
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-lg w-full mx-4 p-10 sm:p-12 bg-white dark:bg-slate-900 rounded-2xl shadow-xl">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 mb-5 shadow-lg shadow-indigo-500/20">
            <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M17 4L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 11V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 17V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold">
            <span className="text-slate-900 dark:text-white">Mock</span><span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">Lane</span>
          </h1>
        </div>

        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white text-center mb-2">
          Welcome back
        </h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 text-center mb-10">
          Enter your email to receive a magic link
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-red-600 dark:text-red-400 text-base">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-base font-semibold disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending...
              </>
            ) : (
              "Send Magic Link"
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-400">
          No password needed. We&apos;ll send you a secure link.
        </p>
      </div>
    </Shell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
          <div className="flex items-center gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-base">Loading...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
