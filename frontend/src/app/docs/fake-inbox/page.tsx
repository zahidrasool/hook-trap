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
  Divider,
} from "../_components";

export const metadata: Metadata = {
  title: "Fake SMTP inbox for testing email",
  description:
    "Catch outbound test email in a sandbox inbox instead of sending it to real customers. SMTP settings plus Node, Python, Django and Rails examples.",
  alternates: { canonical: "/docs/fake-inbox" },
};

export default function DocsFakeInboxPage() {
  return (
    <>
      <H2 id="fake-inbox">Fake Inbox</H2>

      <H3 id="inbox-overview">Overview</H3>
      <P>
        MockLane includes a <strong>fake SMTP inbox</strong> that captures all outgoing emails from your application.
        Instead of accidentally emailing real customers during development and testing, all emails land safely in your workspace inbox.
      </P>
      <Callout type="tip">
        This is especially critical when testing with production data — no more &quot;sorry, that was a test email&quot; moments.
      </Callout>

      <H3 id="inbox-setup">SMTP Configuration</H3>
      <P>Each workspace gets unique SMTP credentials. Navigate to your workspace&apos;s <strong>Inbox</strong> tab and click <strong>Show SMTP Credentials</strong> to get:</P>
      <UL>
        <LI><strong>Host</strong> — The SMTP server address (e.g., <InlineCode>localhost</InlineCode> for local dev)</LI>
        <LI><strong>Port</strong> — Default <InlineCode>2525</InlineCode></LI>
        <LI><strong>Username</strong> — Auto-generated per workspace (e.g., <InlineCode>ws_abc123</InlineCode>)</LI>
        <LI><strong>Password</strong> — Random token, can be regenerated anytime</LI>
      </UL>
      <P>Point your application&apos;s email configuration to these credentials. All emails sent through this SMTP server will be captured and displayed in your inbox — regardless of the recipient address.</P>

      <H3 id="inbox-usage">Using the Inbox</H3>
      <P>The inbox provides a full email client experience:</P>
      <UL>
        <LI><strong>Email list</strong> — See sender, subject, timestamp, and unread indicators</LI>
        <LI><strong>HTML Preview</strong> — Renders HTML emails in a sandboxed preview (safe, no script execution)</LI>
        <LI><strong>Plain Text</strong> — View the plain text version of the email</LI>
        <LI><strong>Headers</strong> — Inspect all email headers (Message-ID, Content-Type, etc.)</LI>
        <LI><strong>Attachments</strong> — Download attached files directly from the inbox</LI>
      </UL>

      <H3 id="inbox-frameworks">Framework Examples</H3>
      <P>Here&apos;s how to configure popular frameworks to use MockLane&apos;s SMTP:</P>

      <CodeBlock title="Node.js (Nodemailer)" lang="javascript">{`const nodemailer = require("nodemailer");

const transport = nodemailer.createTransport({
  host: "localhost",
  port: 2525,
  auth: {
user: "ws_your_workspace_id",
pass: "your_smtp_password"
  }
});

// All emails will be captured by MockLane
await transport.sendMail({
  from: "app@yourcompany.com",
  to: "customer@example.com",  // Won't reach this person!
  subject: "Order Confirmation",
  html: "<h1>Thank you for your order!</h1>"
});`}</CodeBlock>

      <CodeBlock title="Python (smtplib)" lang="python">{`import smtplib
from email.mime.text import MIMEText

msg = MIMEText("<h1>Hello!</h1>", "html")
msg["Subject"] = "Test Email"
msg["From"] = "app@yourcompany.com"
msg["To"] = "customer@example.com"

with smtplib.SMTP("localhost", 2525) as server:
server.login("ws_your_workspace_id", "your_smtp_password")
server.send_message(msg)`}</CodeBlock>

      <CodeBlock title="Django (settings.py)" lang="python">{`EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "localhost"
EMAIL_PORT = 2525
EMAIL_HOST_USER = "ws_your_workspace_id"
EMAIL_HOST_PASSWORD = "your_smtp_password"
EMAIL_USE_TLS = False`}</CodeBlock>

      <CodeBlock title="Rails (config/environments/development.rb)" lang="ruby">{`config.action_mailer.delivery_method = :smtp
config.action_mailer.smtp_settings = {
  address: "localhost",
  port: 2525,
  user_name: "ws_your_workspace_id",
  password: "your_smtp_password",
  authentication: "plain"
}`}</CodeBlock>

      <Divider />

      {/* ─────────────────────────────────────────────────
          ADVANCED
          ───────────────────────────────────────────────── */}
    </>
  );
}
