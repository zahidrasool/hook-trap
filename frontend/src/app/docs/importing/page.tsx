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
  Divider,
} from "../_components";

export const metadata: Metadata = {
  title: "Import an OpenAPI spec or YAML config",
  description:
    "Turn an existing OpenAPI or Swagger specification into working mock endpoints, or define a whole workspace from a YAML config file.",
  alternates: { canonical: "/docs/importing" },
};

export default function DocsImportingPage() {
  return (
    <>
      <H2 id="importing">Importing</H2>

      <H3 id="openapi-import">OpenAPI / Swagger Import</H3>
      <P>Import your OpenAPI 3.0 or Swagger 2.0 spec to auto-generate mock endpoints.</P>
      <Steps>
        <Step n={1}>Navigate to your workspace &rarr; <strong>Import</strong> tab.</Step>
        <Step n={2}>Paste your OpenAPI YAML/JSON or upload a file.</Step>
        <Step n={3}>Click <strong>Preview Endpoints</strong> to see detected paths.</Step>
        <Step n={4}>Select which endpoints to import.</Step>
        <Step n={5}>Click <strong>Import</strong>.</Step>
      </Steps>
      <P>
        Response bodies are auto-generated from your spec&apos;s response schemas, including <InlineCode>$ref</InlineCode> resolution and example values.
      </P>
      <Callout type="info">
        If your spec defines <InlineCode>example</InlineCode> values, those are used directly. Otherwise, MockLane generates realistic mock data using template generators.
      </Callout>

      <H3 id="yaml-config-import">YAML Config Import</H3>
      <P>
        Define multiple models and their relationships in a single YAML file. MockLane auto-generates full CRUD endpoints for each model.
      </P>
      <CodeBlock title="mockend.yaml" lang="yaml">{`models:
  User:
fields:
  id: "{{randomUUID}}"
  name: "{{faker.fullName}}"
  email: "{{faker.email}}"
  avatar: "{{faker.avatar}}"
count: 10

  Post:
fields:
  id: "{{randomUUID}}"
  title: "{{faker.sentence}}"
  body: "{{faker.paragraph}}"
  userId: "{{ref:User.id}}"
count: 25

  Comment:
fields:
  id: "{{randomUUID}}"
  text: "{{faker.sentence}}"
  postId: "{{ref:Post.id}}"
  authorId: "{{ref:User.id}}"
count: 50`}</CodeBlock>
      <P>
        This generates <InlineCode>GET /users</InlineCode>, <InlineCode>GET /users/:id</InlineCode>, <InlineCode>POST /users</InlineCode>, etc. for each model. Relationships are automatically linked using <InlineCode>{"{{ref:Model.field}}"}</InlineCode>.
      </P>
      <Steps>
        <Step n={1}>On the Mocks page, click <strong>YAML Import</strong>.</Step>
        <Step n={2}>Paste your YAML config or upload a file.</Step>
        <Step n={3}>Click <strong>Import</strong>.</Step>
      </Steps>

      <Divider />

      {/* ─────────────────────────────────────────────────
          REST API
          ───────────────────────────────────────────────── */}
    </>
  );
}
