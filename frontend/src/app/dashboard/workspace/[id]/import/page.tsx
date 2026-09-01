"use client";

import { useParams, useRouter } from "next/navigation";
import { OpenAPIImportWizard } from "@/components/mock/OpenAPIImportWizard";

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Import OpenAPI Spec</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload an OpenAPI/Swagger specification to automatically generate mock endpoints for your workspace.
        </p>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-6">
        <OpenAPIImportWizard
          workspaceId={workspaceId}
          onComplete={() => router.push(`/dashboard/workspace/${workspaceId}/mocks`)}
        />
      </div>
    </div>
  );
}
