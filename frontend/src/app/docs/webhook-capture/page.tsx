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
  Endpoint,
  Divider,
} from "../_components";

export const metadata: Metadata = {
  title: "How to capture and replay webhooks",
  description:
    "Point Stripe, GitHub or any provider at a MockLane capture URL, inspect the exact payload, headers and source IP, and replay any request on demand.",
  alternates: { canonical: "/docs/webhook-capture" },
};

export default function DocsWebhookCapturePage() {
  return (
    <>
      <H2 id="webhook-capture">Webhook Capture</H2>

      <H3 id="capture-overview">How Capture Works</H3>
      <P>
        MockLane gives you unique URLs that accept <strong>any HTTP request</strong> and stores the complete request data &mdash; headers, body, query parameters, and metadata &mdash; for inspection.
      </P>
      <CodeBlock title="Capture URL format" lang="http">{`POST https://mocklane.com/h/{endpoint-short-id}

# Your unique capture URL accepts any method:
# GET, POST, PUT, DELETE, PATCH, etc.`}</CodeBlock>

      <H3 id="create-endpoint">Creating an Endpoint</H3>
      <Steps>
        <Step n={1}>Go to the <strong>Dashboard</strong> and click <strong>Create Endpoint</strong>.</Step>
        <Step n={2}>You&apos;ll receive a unique URL like <InlineCode>https://mocklane.com/h/abc123</InlineCode>.</Step>
        <Step n={3}>Copy this URL and paste it as the webhook URL in your service&apos;s settings (Stripe, GitHub, etc.).</Step>
        <Step n={4}>Requests sent to this URL will appear in your <strong>Captures</strong> page in real time.</Step>
      </Steps>
      <Callout type="tip">
        Your capture URL works with any HTTP method and content type. JSON, XML, form data, or plain text &mdash; MockLane captures everything.
      </Callout>

      <H3 id="inspect-captures">Inspecting Captures</H3>
      <P>Navigate to <strong>Captures</strong> in the sidebar. Click any capture to see:</P>
      <UL>
        <LI><strong>Headers</strong> &mdash; All HTTP headers sent with the request.</LI>
        <LI><strong>Body</strong> &mdash; Raw request body with auto-formatted JSON.</LI>
        <LI><strong>Query Parameters</strong> &mdash; URL query string values.</LI>
        <LI><strong>Metadata</strong> &mdash; Method, content type, source IP, timestamp, payload size.</LI>
      </UL>

      <H3 id="replay-requests">Replaying Requests</H3>
      <Steps>
        <Step n={1}>Open a captured request.</Step>
        <Step n={2}>Click the <strong>Replay</strong> button.</Step>
        <Step n={3}>Optionally modify the target URL, headers, or body.</Step>
        <Step n={4}>View the replay response to verify your application&apos;s behavior.</Step>
      </Steps>

      <Divider />

      {/* ─────────────────────────────────────────────────
          MOCK APIs
          ───────────────────────────────────────────────── */}
    </>
  );
}
