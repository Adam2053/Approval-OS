import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { asset, comment, membership, reviewer, version, workspace, type Annotation } from "@/db/schema";
import type { RequestRow } from "./approvals";
import { logActivity, notifyUsers, projectMemberIds } from "./events";

const unit = z.number().min(0).max(1);
export const annotationSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("pin"), x: unit, y: unit }),
    z.object({ type: z.literal("box"), x: unit, y: unit, w: unit, h: unit }),
  ])
  .nullable()
  .optional();

export const commentInput = z.object({
  versionId: z.string(),
  assetId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  body: z.string().trim().min(1, "Write a comment").max(5000),
  visibility: z.enum(["shared", "internal"]).default("shared"),
  annotation: annotationSchema,
  captionQuote: z.string().max(2000).nullable().optional(),
});

const MENTION = /<@([\w-]+)>/g;

export function mentionedIds(body: string) {
  return [...body.matchAll(MENTION)].map((m) => m[1]!);
}

export async function createComment(
  req: RequestRow,
  author: { kind: "team"; userId: string; name: string; slug: string } | { kind: "client"; reviewer: typeof reviewer.$inferSelect },
  raw: unknown,
) {
  const input = commentInput.parse(raw);
  const [v] = await db
    .select()
    .from(version)
    .where(and(eq(version.id, input.versionId), eq(version.requestId, req.id)));
  if (!v) throw new Error("Unknown version");
  if (author.kind === "client" && !v.sentAt) throw new Error("Unknown version");
  if (input.assetId) {
    const [a] = await db.select({ id: asset.id }).from(asset).where(and(eq(asset.id, input.assetId), eq(asset.versionId, v.id)));
    if (!a) throw new Error("Unknown image");
  }
  let visibility = author.kind === "client" ? "shared" : input.visibility;
  if (input.parentId) {
    const [parent] = await db.select().from(comment).where(and(eq(comment.id, input.parentId), eq(comment.requestId, req.id)));
    if (!parent || (author.kind === "client" && parent.visibility === "internal")) throw new Error("Unknown thread");
    // Replies inherit the thread's visibility so internal threads never leak to clients.
    if (parent.visibility === "internal") visibility = "internal";
  }
  const [created] = await db
    .insert(comment)
    .values({
      workspaceId: req.workspaceId,
      requestId: req.id,
      versionId: v.id,
      assetId: input.parentId ? null : (input.assetId ?? null),
      parentId: input.parentId ?? null,
      authorUserId: author.kind === "team" ? author.userId : null,
      authorReviewerId: author.kind === "client" ? author.reviewer.id : null,
      body: input.body,
      visibility: visibility as "shared" | "internal",
      annotation: input.parentId ? null : ((input.annotation ?? null) as Annotation | null),
      captionQuote: input.parentId ? null : (input.captionQuote ?? null),
    })
    .returning();

  if (author.kind === "client") {
    await logActivity({
      workspaceId: req.workspaceId,
      requestId: req.id,
      projectId: req.projectId,
      clientId: req.clientId,
      actorReviewerId: author.reviewer.id,
      actorName: author.reviewer.name,
      action: "client.commented",
      meta: { version: v.number },
    });
    const ids = [...(await projectMemberIds(req.projectId)), req.createdBy].filter((x): x is string => !!x);
    const [ws] = await db.select({ slug: workspace.slug }).from(workspace).where(eq(workspace.id, req.workspaceId));
    await notifyUsers({
      workspaceId: req.workspaceId,
      userIds: ids,
      type: "client_comment",
      title: `💬 ${author.reviewer.name} commented on “${req.title}”`,
      body: input.body.slice(0, 200),
      link: `/w/${ws!.slug}/approvals/${req.id}`,
    });
  } else {
    const mentioned = mentionedIds(input.body).filter((id) => id !== author.userId);
    if (mentioned.length) {
      const valid = await db
        .select({ userId: membership.userId })
        .from(membership)
        .where(eq(membership.workspaceId, req.workspaceId));
      const ok = new Set(valid.map((m) => m.userId));
      await notifyUsers({
        workspaceId: req.workspaceId,
        userIds: mentioned.filter((id) => ok.has(id)),
        type: "mention",
        title: `${author.name} mentioned you on “${req.title}”`,
        body: input.body.replace(MENTION, "@…").slice(0, 200),
        link: `/w/${author.slug}/approvals/${req.id}`,
        email: true,
      });
    }
  }
  return created!;
}
