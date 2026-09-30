import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { client, project } from "@/db/schema";
import { env } from "@/lib/env";
import { canWorkOnProject, requireWorkspace } from "@/lib/session";
import { NewApprovalForm } from "./new-approval-form";

export const metadata = { title: "New approval" };

export default async function NewApprovalPage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = await params;
  const ctx = await requireWorkspace(slug);
  const [row] = await db
    .select({ project, client })
    .from(project)
    .innerJoin(client, eq(client.id, project.clientId))
    .where(and(eq(project.id, projectId), eq(project.workspaceId, ctx.workspace.id)));
  if (!row) notFound();
  const allowed = await canWorkOnProject(ctx, projectId);
  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`/w/${slug}/projects/${projectId}`} className="hover:text-zinc-800">
            {row.client.name} / {row.project.name}
          </Link>
        }
        title="New approval request"
        description="Upload the creative, add the caption, and get it approved."
      />
      {allowed ? (
        <NewApprovalForm slug={slug} projectId={projectId} requireInternalApproval={row.project.requireInternalApproval} maxMb={env.maxUploadMb} />
      ) : (
        <Card className="p-6 text-sm text-zinc-600">
          Only people assigned to this project (or workspace admins) can request approvals. Ask a project member to add you.
        </Card>
      )}
    </>
  );
}
