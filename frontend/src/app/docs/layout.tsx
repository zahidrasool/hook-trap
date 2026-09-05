import { DocsShell } from "./_shell";

// Every page under /docs sets its own title, description and canonical, so no
// metadata is declared here — a fallback at this level would only mask a page
// that forgot to set one.
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DocsShell>{children}</DocsShell>;
}
