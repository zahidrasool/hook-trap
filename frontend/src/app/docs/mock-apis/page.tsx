import type { Metadata } from "next";
import {
  CodeBlock,
  InlineCode,
  Callout,
  H2,
  H3,
  P,
  Steps,
  Step,
  UL,
  LI,
  MethodBadge,
  Endpoint,
  Divider,
} from "../_components";
import { GENERATORS } from "../_generators";

export const metadata: Metadata = {
  title: "Mock API endpoints and the template engine",
  description:
    "Build a mock REST API with dynamic templated responses, 121 data generators, conditional rules, response sequences, static data and error simulation.",
  alternates: { canonical: "/docs/mock-apis" },
};

export default function DocsMockApisPage() {
  return (
    <>
      <H2 id="mock-apis">Mock APIs</H2>

      <H3 id="mock-overview">Overview</H3>
      <P>
        Create fully functional API endpoints without server-side code. Define endpoints, set response bodies with dynamic data, and share a working API URL with your team.
      </P>
      <P>Mock endpoints are served at:</P>
      <CodeBlock lang="http">{`https://mocklane.com/m/{workspace-short-id}{path}

# Example:
GET https://mocklane.com/m/abc-xyz/api/users
GET https://mocklane.com/m/abc-xyz/api/users/42`}</CodeBlock>

      <H3 id="create-mock">Creating a Mock Endpoint</H3>
      <Steps>
        <Step n={1}>Navigate to your workspace &rarr; <strong>Mocks</strong> tab.</Step>
        <Step n={2}>Click <strong>New Mock</strong>.</Step>
        <Step n={3}>Set the HTTP method (<MethodBadge method="GET" />, <MethodBadge method="POST" />, <MethodBadge method="PUT" />, <MethodBadge method="PATCH" />, <MethodBadge method="DELETE" />).</Step>
        <Step n={4}>Set the path (e.g., <InlineCode>/api/users</InlineCode> or <InlineCode>/api/users/:id</InlineCode>).</Step>
        <Step n={5}>Click <strong>Create</strong> to open the editor.</Step>
      </Steps>
      <Callout type="tip">
        Use path parameters with a colon prefix: <InlineCode>/api/users/:id</InlineCode> matches requests like <InlineCode>/api/users/123</InlineCode>.
      </Callout>

      <H3 id="response-body">Response Body & Status</H3>
      <P>Configure the response consumers will receive:</P>
      <UL>
        <LI><strong>Status Code</strong> &mdash; 200, 201, 404, 500, etc.</LI>
        <LI><strong>Response Headers</strong> &mdash; Custom headers (<InlineCode>Content-Type</InlineCode> defaults to <InlineCode>application/json</InlineCode>).</LI>
        <LI><strong>Response Body</strong> &mdash; JSON with optional template variables.</LI>
        <LI><strong>Response Delay</strong> &mdash; Simulate latency in milliseconds.</LI>
      </UL>

      <H3 id="template-engine">Template Engine</H3>
      <P>
        Embed dynamic generators in your JSON response using <InlineCode>{"{{...}}"}</InlineCode> syntax. Each call produces fresh random values.
      </P>
      <CodeBlock title="Response body with generators" lang="json">{`{
  "id": "{{randomUUID}}",
  "name": "{{faker.fullName}}",
  "email": "{{faker.email}}",
  "age": "{{randomInt 18 65}}",
  "avatar": "{{faker.avatar}}",
  "joined": "{{now}}",
  "address": {
"city": "{{faker.city}}",
"country": "{{faker.country}}"
  }
}`}</CodeBlock>
      <P>Each request returns unique data:</P>
      <CodeBlock title="Example response" lang="json">{`{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Emma Johnson",
  "email": "emma.johnson@example.com",
  "age": 34,
  "avatar": "https://i.pravatar.cc/150?u=550e8400",
  "joined": "2026-04-12T10:30:00Z",
  "address": {
"city": "San Francisco",
"country": "United States"
  }
}`}</CodeBlock>

      <H3 id="generator-reference">Generator Reference</H3>
      <P>MockLane includes 121 built-in generators, plus direct access to any Faker method via <code>{'{{faker.method()}}'}</code>. Use the <strong>Template Helper</strong> picker in the editor or type them manually.</P>

      {GENERATORS.map((cat) => (
        <div key={cat.name} className="mb-6">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            {cat.name}
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Template</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cat.items.map(([tmpl, example]) => (
                  <tr key={tmpl} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-mono text-[13px] text-indigo-600 dark:text-indigo-400">{tmpl}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 text-[13px]">{example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <H3 id="response-rules">Conditional Response Rules</H3>
      <P>
        Return different responses based on the incoming request. Each rule has its own status code, headers, and body.
      </P>
      <P>Match conditions can test against:</P>
      <UL>
        <LI><strong>Headers</strong> &mdash; e.g., when <InlineCode>Authorization</InlineCode> contains &quot;Bearer&quot;.</LI>
        <LI><strong>Query Parameters</strong> &mdash; e.g., when <InlineCode>status=active</InlineCode>.</LI>
        <LI><strong>Body Fields</strong> &mdash; e.g., when <InlineCode>type</InlineCode> equals &quot;premium&quot;.</LI>
        <LI><strong>Path Parameters</strong> &mdash; e.g., when <InlineCode>:id</InlineCode> equals &quot;404&quot;.</LI>
      </UL>
      <P>Rules are evaluated in priority order. First match wins. If none match, the default response is returned.</P>

      <H3 id="response-sequences">Response Sequences</H3>
      <P>
        Define a series of responses returned in order, one per request. Useful for simulating state changes:
      </P>
      <CodeBlock title="Sequence example">{`Step 1 → 200 {"status": "pending"}
Step 2 → 200 {"status": "processing"}
Step 3 → 200 {"status": "completed"}
     ↩ loops back to Step 1`}</CodeBlock>
      <P>When <strong>Loop</strong> is enabled, the sequence restarts after the last step. Otherwise, the last step repeats indefinitely.</P>

      <H3 id="static-data">Static Data Mode</H3>
      <P>
        Define a fixed JSON array of records. MockLane auto-generates full CRUD behavior:
      </P>
      <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Method</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Path</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr><td className="px-4 py-2.5"><MethodBadge method="GET" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Returns full array</td></tr>
            <tr><td className="px-4 py-2.5"><MethodBadge method="GET" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users/:id</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Single record by ID</td></tr>
            <tr><td className="px-4 py-2.5"><MethodBadge method="POST" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Add record</td></tr>
            <tr><td className="px-4 py-2.5"><MethodBadge method="PUT" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users/:id</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Update record</td></tr>
            <tr><td className="px-4 py-2.5"><MethodBadge method="DELETE" /></td><td className="px-4 py-2.5 font-mono text-[13px] text-slate-700 dark:text-slate-200">/api/users/:id</td><td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">Remove record</td></tr>
          </tbody>
        </table>
      </div>

      <H3 id="immutable-mode">Immutable Mode</H3>
      <P>
        Enable <strong>Immutable Mode</strong> to restrict an endpoint to <MethodBadge method="GET" /> requests only. All write methods return <InlineCode>405 Method Not Allowed</InlineCode>. Useful for exposing read-only data.
      </P>

      <H3 id="error-simulation">Error Simulation</H3>
      <P>Test error handling by configuring:</P>
      <UL>
        <LI><strong>Error Rate</strong> &mdash; Percentage of requests that return an error (0&ndash;100%).</LI>
        <LI><strong>Error Status</strong> &mdash; HTTP status code for errors (e.g., 500, 503).</LI>
        <LI><strong>Error Body</strong> &mdash; Custom JSON body for error responses.</LI>
      </UL>
      <P>Example: set 20% error rate with 503 status to simulate intermittent outages.</P>

      <H3 id="mock-url">Mock URL</H3>
      <P>Every mock endpoint has a live URL displayed at the top of the editor. Use it in your frontend, mobile app, or any HTTP client:</P>
      <CodeBlock title="Usage examples" lang="bash">{`# cURL
curl https://mocklane.com/m/abc-xyz/api/users

# JavaScript
const res = await fetch("https://mocklane.com/m/abc-xyz/api/users");
const data = await res.json();

# Python
import requests
r = requests.get("https://mocklane.com/m/abc-xyz/api/users")
data = r.json()`}</CodeBlock>

      <Divider />

      {/* ─────────────────────────────────────────────────
          IMPORTING
          ───────────────────────────────────────────────── */}
    </>
  );
}
