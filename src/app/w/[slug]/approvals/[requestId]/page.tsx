import { notFound } from "next/navigation";
import { buildReviewPayload, loadRequest } from "@/lib/approvals";
import { env } from "@/lib/env";
import { workspaceMembers } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { TeamReview } from "./team-review";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; requestId: string }> }) {
  const { slug, requestId } = await params;
  const ctx = await requireWorkspace(slug);
  const loaded = await loadRequest(ctx, requestId);
  return { title: loaded?.request.title ?? "Approval" };
}

export default async function ApprovalPage({ params }: { params: Promise<{ slug: string; requestId: string }> }) {
  const { slug, requestId } = await params;
  const ctx = await requireWorkspace(slug);
  const loaded = await loadRequest(ctx, requestId);
  if (!loaded) notFound();
  const [payload, members] = await Promise.all([
    buildReviewPayload(loaded.request, { kind: "team", userId: ctx.user.id, ctx }),
    workspaceMembers(ctx.workspace.id),
  ]);
  return (
    <TeamReview
      slug={slug}
      initial={JSON.parse(JSON.stringify(payload))}
      maxMb={env.maxUploadMb}
      members={members.map((m) => ({ id: m.userId, name: m.name, image: m.image, designation: m.designation }))}
    />
  );
}
