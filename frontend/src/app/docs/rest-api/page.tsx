import type { Metadata } from "next";
import {
  CodeBlock,
  H2,
  H3,
  P,
  Endpoint,
  Divider,
} from "../_components";

export const metadata: Metadata = {
  title: "Static data REST API",
  description:
    "Serve a JSON collection as a full REST API: filtering with query parameters and operators, sorting, pagination and nested resources.",
  alternates: { canonical: "/docs/rest-api" },
};

export default function DocsRestApiPage() {
  return (
    <>
      <H2 id="rest-api">REST API</H2>

      <H3 id="rest-endpoints">Endpoints</H3>
      <P>When you create a mock endpoint or import models with static data, the following REST routes are available:</P>
      <div className="my-5 space-y-1 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        <Endpoint method="GET" path="/m/{ws}/{resource}" description="List all records" />
        <Endpoint method="GET" path="/m/{ws}/{resource}/:id" description="Get single record" />
        <Endpoint method="POST" path="/m/{ws}/{resource}" description="Create record" />
        <Endpoint method="PUT" path="/m/{ws}/{resource}/:id" description="Replace record" />
        <Endpoint method="PATCH" path="/m/{ws}/{resource}/:id" description="Update record" />
        <Endpoint method="DELETE" path="/m/{ws}/{resource}/:id" description="Delete record" />
      </div>

      <H3 id="rest-query">Query Parameters</H3>
      <P>Filter, sort, and paginate results using query parameters:</P>
      <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Parameter</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Example</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?field_eq=value</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Equals</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?status_eq=active</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?field_ne=value</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Not equals</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?role_ne=guest</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?field_gt=value</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Greater than</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?age_gt=18</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?field_lt=value</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Less than</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?price_lt=100</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">?q=keyword</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Full-text search</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?q=emma</td></tr>
          </tbody>
        </table>
      </div>

      <H3 id="rest-operators">Operators</H3>
      <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Suffix</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Operator</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_eq</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">==</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Equal to</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_ne</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">!=</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Not equal</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_gt</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">&gt;</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Greater than</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_gte</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">&gt;=</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Greater or equal</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_lt</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">&lt;</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Less than</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_lte</td><td className="px-4 py-2 text-slate-700 dark:text-slate-200">&lt;=</td><td className="px-4 py-2 text-slate-500 dark:text-slate-400">Less or equal</td></tr>
          </tbody>
        </table>
      </div>

      <H3 id="rest-sort">Sort & Paginate</H3>
      <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Parameter</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Example</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_sort</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Sort by field</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?_sort=name</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_order</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Sort direction</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?_order=desc</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_limit</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Max records</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?_limit=10</td></tr>
            <tr><td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">_offset</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">Skip records</td><td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[13px]">?_offset=20</td></tr>
          </tbody>
        </table>
      </div>
      <CodeBlock title="Example: sorted & paginated" lang="http">{`GET /m/abc-xyz/api/users?_sort=name&_order=asc&_limit=10&_offset=0`}</CodeBlock>

      <H3 id="rest-nested">Nested Resources</H3>
      <P>When models have relationships defined (via YAML config), you can query nested resources:</P>
      <CodeBlock lang="http">{`# Get all posts by a specific user
GET /m/abc-xyz/api/users/42/posts

# Get all comments on a specific post
GET /m/abc-xyz/api/posts/7/comments`}</CodeBlock>

      <Divider />

      {/* ─────────────────────────────────────────────────
          FAKE INBOX
          ───────────────────────────────────────────────── */}
    </>
  );
}
