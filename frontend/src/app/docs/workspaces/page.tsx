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
  Divider,
} from "../_components";

export const metadata: Metadata = {
  title: "Workspaces, roles and API keys",
  description:
    "Create a MockLane workspace, invite team members, set owner/admin/editor/viewer roles, and control public or private access with an API key.",
  alternates: { canonical: "/docs/workspaces" },
};

export default function DocsWorkspacesPage() {
  return (
    <>
      <H2 id="workspaces">Workspaces</H2>

      <H3 id="create-workspace">Creating a Workspace</H3>
      <P>Workspaces organize mock endpoints and team members into separate projects.</P>
      <Steps>
        <Step n={1}>Click <strong>New Workspace</strong> in the left sidebar.</Step>
        <Step n={2}>Enter a name (e.g., &quot;Payment Integration&quot;, &quot;Mobile App API&quot;).</Step>
        <Step n={3}>Click <strong>Create Workspace</strong>.</Step>
      </Steps>

      <H3 id="workspace-settings">Workspace Settings</H3>
      <P>Navigate to your workspace &rarr; <strong>Settings</strong> tab to:</P>
      <UL>
        <LI>Rename the workspace.</LI>
        <LI>Toggle public / private visibility.</LI>
        <LI>Generate or regenerate the API key.</LI>
        <LI>Delete the workspace (irreversible).</LI>
      </UL>

      <H3 id="invite-members">Inviting Team Members</H3>
      <Steps>
        <Step n={1}>Go to your workspace &rarr; <strong>Members</strong> tab.</Step>
        <Step n={2}>Enter the email of the person you want to invite.</Step>
        <Step n={3}>Select their role: <InlineCode>viewer</InlineCode>, <InlineCode>editor</InlineCode>, or <InlineCode>admin</InlineCode>.</Step>
        <Step n={4}>Click <strong>Invite</strong>. They&apos;ll receive an email with a link to join.</Step>
      </Steps>

      <H3 id="workspace-roles">Roles & Permissions</H3>
      <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-200">Role</th>
              <th className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">View</th>
              <th className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">Create/Edit</th>
              <th className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">Delete</th>
              <th className="px-4 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">Manage Members</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              { role: "Viewer", perms: [true, false, false, false] },
              { role: "Editor", perms: [true, true, false, false] },
              { role: "Admin", perms: [true, true, true, true] },
            ].map((row) => (
              <tr key={row.role}>
                <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{row.role}</td>
                {row.perms.map((ok, i) => (
                  <td key={i} className="px-4 py-2.5 text-center">
                    {ok ? (
                      <svg className="w-4 h-4 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-200 dark:text-slate-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H3 id="public-private">Public vs Private Workspaces</H3>
      <P>
        By default, workspaces are <strong>public</strong> &mdash; anyone with the mock URL can call the endpoints. This is ideal for quick prototyping.
      </P>
      <P>
        <strong>Private workspaces</strong> require an API key in every request. Toggle this in Workspace Settings.
      </P>
      <CodeBlock title="Private workspace request" lang="bash">{`curl -H "X-API-Key: your-workspace-api-key" \\
  https://mocklane.com/m/abc-xyz/api/users`}</CodeBlock>

      <H3 id="api-keys">API Keys</H3>
      <P>
        When you make a workspace private, an API key is automatically generated. Pass it via the <InlineCode>X-API-Key</InlineCode> header or <InlineCode>?api_key=</InlineCode> query parameter.
      </P>
      <Callout type="warning">
        Regenerating an API key immediately invalidates the old one. Update all consumers before regenerating.
      </Callout>

      <Divider />

      {/* ─────────────────────────────────────────────────
          WEBHOOK CAPTURE
          ───────────────────────────────────────────────── */}
    </>
  );
}
