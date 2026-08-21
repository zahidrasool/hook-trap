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
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Import OpenAPI Spec</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload an OpenAPI/Swagger specification to automatically generate mock endpoints for your workspace.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
        <OpenAPIImportWizard
          workspaceId={workspaceId}
          onComplete={() => router.push(`/dashboard/workspace/${workspaceId}/mocks`)}
        />
      </div>
    </div>
  );
}
