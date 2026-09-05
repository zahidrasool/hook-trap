/* Documentation navigation.
 *
 * `href` is the page each group now lives on. The docs used to be one URL with
 * in-page anchors, which meant every search engine and AI answer engine could
 * only ever cite mocklane.com/docs no matter which topic answered the question.
 * Splitting the groups into their own routes gives each topic its own title,
 * description and citable URL; the section ids stay as in-page anchors within
 * their group.
 */

export type DocSection = { id: string; title: string };
export type DocGroup = { id: string; title: string; href: string; sections: DocSection[] };

export const TOC: DocGroup[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    href: "/docs",
    sections: [
      { id: "overview", title: "Overview" },
      { id: "create-account", title: "Create an Account" },
      { id: "dashboard-tour", title: "Dashboard Tour" },
    ],
  },
  {
    id: "workspaces",
    title: "Workspaces",
    href: "/docs/workspaces",
    sections: [
      { id: "create-workspace", title: "Creating a Workspace" },
      { id: "workspace-settings", title: "Workspace Settings" },
      { id: "invite-members", title: "Inviting Team Members" },
      { id: "workspace-roles", title: "Roles & Permissions" },
      { id: "public-private", title: "Public vs Private" },
      { id: "api-keys", title: "API Keys" },
    ],
  },
  {
    id: "webhook-capture",
    title: "Webhook Capture",
    href: "/docs/webhook-capture",
    sections: [
      { id: "capture-overview", title: "How Capture Works" },
      { id: "create-endpoint", title: "Creating an Endpoint" },
      { id: "inspect-captures", title: "Inspecting Captures" },
      { id: "replay-requests", title: "Replaying Requests" },
    ],
  },
  {
    id: "mock-apis",
    title: "Mock APIs",
    href: "/docs/mock-apis",
    sections: [
      { id: "mock-overview", title: "Overview" },
      { id: "create-mock", title: "Creating a Mock" },
      { id: "response-body", title: "Response Body & Status" },
      { id: "template-engine", title: "Template Engine" },
      { id: "generator-reference", title: "Generator Reference" },
      { id: "response-rules", title: "Conditional Rules" },
      { id: "response-sequences", title: "Sequences" },
      { id: "static-data", title: "Static Data Mode" },
      { id: "immutable-mode", title: "Immutable Mode" },
      { id: "error-simulation", title: "Error Simulation" },
      { id: "mock-url", title: "Mock URL" },
    ],
  },
  {
    id: "importing",
    title: "Importing",
    href: "/docs/importing",
    sections: [
      { id: "openapi-import", title: "OpenAPI / Swagger" },
      { id: "yaml-config-import", title: "YAML Config" },
    ],
  },
  {
    id: "rest-api",
    title: "REST API",
    href: "/docs/rest-api",
    sections: [
      { id: "rest-endpoints", title: "Endpoints" },
      { id: "rest-query", title: "Query Parameters" },
      { id: "rest-operators", title: "Operators" },
      { id: "rest-sort", title: "Sort & Paginate" },
      { id: "rest-nested", title: "Nested Resources" },
    ],
  },
  {
    id: "fake-inbox",
    title: "Fake Inbox",
    href: "/docs/fake-inbox",
    sections: [
      { id: "inbox-overview", title: "Overview" },
      { id: "inbox-setup", title: "SMTP Configuration" },
      { id: "inbox-usage", title: "Using the Inbox" },
      { id: "inbox-frameworks", title: "Framework Examples" },
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    href: "/docs/advanced",
    sections: [
      { id: "request-logs", title: "Request Logs" },
      { id: "contract-validation", title: "Contract Validation" },
      { id: "cors-support", title: "CORS Support" },
      { id: "rate-limiting", title: "Rate Limiting" },
    ],
  },
];


/** Anchor id -> the page that now contains it, for cross-page links. */
export const SECTION_HREF: Record<string, string> = Object.fromEntries(
  TOC.flatMap((g) => g.sections.map((s) => [s.id, `${g.href}#${s.id}`])),
);
