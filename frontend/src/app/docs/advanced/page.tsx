import type { Metadata } from "next";
import {
  CodeBlock,
  InlineCode,
  Callout,
  H2,
  H3,
  P,
  UL,
  LI,
  Endpoint,
} from "../_components";

export const metadata: Metadata = {
  title: "Request logs, contract validation, CORS and rate limits",
  description:
    "MockLane request logging, contract validation against a spec, CORS behaviour for browser callers, and the published rate limits.",
  alternates: { canonical: "/docs/advanced" },
};

export default function DocsAdvancedPage() {
  return (
    <>
      <H2 id="advanced">Advanced</H2>

      <H3 id="request-logs">Request Logs</H3>
      <P>Every request to your mock endpoints is logged. View from the mock detail page:</P>
      <UL>
        <LI>Timestamp and HTTP method.</LI>
        <LI>Full request headers and body.</LI>
        <LI>The response returned (including which rule or sequence step triggered).</LI>
        <LI>Response time in milliseconds.</LI>
      </UL>

      <H3 id="contract-validation">Contract Validation</H3>
      <P>The Contract Validator checks incoming requests against your endpoint&apos;s expected schema:</P>
      <UL>
        <LI>Required fields are present.</LI>
        <LI>Field types match expectations.</LI>
        <LI>Response format adheres to the defined schema.</LI>
      </UL>

      <H3 id="cors-support">CORS Support</H3>
      <P>
        All mock endpoints respond to CORS preflight (<InlineCode>OPTIONS</InlineCode>) with permissive headers. Call mock APIs directly from browser JavaScript without CORS issues.
      </P>

      <H3 id="rate-limiting">Rate Limiting</H3>
      <P>
        Public endpoints are rate-limited per client IP to keep one noisy
        script from degrading the platform for everyone. Current limits:
      </P>

      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-left">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">Endpoint</th>
              <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">Limit</th>
              <th className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">Max body</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr>
              <td className="px-4 py-2.5"><InlineCode>/m/*</InlineCode> mock serving</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">300 / minute</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">1 MiB</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5"><InlineCode>/h/*</InlineCode> webhook capture</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">60 / minute</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">1 MiB</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5">Sign-in link requests</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">5 / hour per address, 20 / hour per IP</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">&mdash;</td>
            </tr>
          </tbody>
        </table>
      </div>

      <P>
        Every response from <InlineCode>/m/*</InlineCode> and <InlineCode>/h/*</InlineCode> carries
        your remaining budget, so you can back off before being blocked rather
        than discovering the limit by hitting it:
      </P>

      <CodeBlock title="Response headers" lang="http">{`X-RateLimit-Limit: 300
X-RateLimit-Remaining: 297
X-RateLimit-Reset: 60`}</CodeBlock>

      <P>
        Exceeding a limit returns <InlineCode>429 Too Many Requests</InlineCode> with a{" "}
        <InlineCode>Retry-After</InlineCode> header giving the seconds until the
        window resets. Requests over the size cap return{" "}
        <InlineCode>413 Payload Too Large</InlineCode>.
      </P>

      <Callout type="tip">
        Preflight <InlineCode>OPTIONS</InlineCode> requests are not counted
        against your budget.
      </Callout>

      {/* ── Footer ── */}
    </>
  );
}
