import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { decisionLog, message, user } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";
import { channelAccess } from "@/lib/chat";

/** Logs a project-discussion message as a decision in the project's decision log. */
export const POST = withWorkspace<{ slug: string; id: string }>(async (req, ctx, { id }) => {
  const [m] = await db
    .select()
    .from(message)
    .where(and(eq(message.id, id), eq(message.workspaceId, ctx.workspace.id)));
  if (!m || m.deletedAt) return json({ error: "Not found" }, { status: 404 });
  const { channel: ch } = await channelAccess(ctx, m.channelId);
  if (ch.kind !== "project" || !ch.projectId) return json({ error: "Decisions can be logged from project discussions" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { title?: string; details?: string };
  const [author] = m.userId ? await db.select({ name: user.name }).from(user).where(eq(user.id, m.userId)) : [];
  const text = m.body.replace(/<@[\w-]+>/g, "@…");
  const title = (body.title?.trim() || text.split("\n")[0] || "Decision").slice(0, 300);
  await db.insert(decisionLog).values({
    workspaceId: ctx.workspace.id,
    projectId: ch.projectId,
    title,
    details: body.details?.trim() || (text.length > title.length ? text : null),
    status: "decided",
    source: "chat",
    messageId: m.id,
    decidedBy: author?.name ?? ctx.user.name,
    createdBy: ctx.user.id,
  });
  return json({ ok: true });
});
