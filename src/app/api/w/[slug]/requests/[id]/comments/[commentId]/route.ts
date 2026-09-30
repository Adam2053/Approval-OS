import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { comment } from "@/db/schema";
import { loadRequest } from "@/lib/approvals";
import { json, withWorkspace } from "@/lib/api";

type P = { slug: string; id: string; commentId: string };

async function load(ctxWorkspaceId: string, requestId: string, commentId: string) {
  const [c] = await db
    .select()
    .from(comment)
    .where(and(eq(comment.id, commentId), eq(comment.requestId, requestId), eq(comment.workspaceId, ctxWorkspaceId)));
  return c ?? null;
}

/** Resolve / unresolve (any teammate) or edit the body (author only). */
export const PATCH = withWorkspace<P>(async (req, ctx, { id, commentId }) => {
  if (!(await loadRequest(ctx, id))) return json({ error: "Not found" }, { status: 404 });
  const c = await load(ctx.workspace.id, id, commentId);
  if (!c) return json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as { resolved?: boolean; body?: string };
  if (typeof body.resolved === "boolean") {
    await db
      .update(comment)
      .set(body.resolved ? { resolvedAt: new Date(), resolvedBy: ctx.user.id } : { resolvedAt: null, resolvedBy: null })
      .where(eq(comment.id, c.id));
  }
  if (typeof body.body === "string") {
    if (c.authorUserId !== ctx.user.id) return json({ error: "You can only edit your own comments" }, { status: 403 });
    const text = body.body.trim();
    if (!text) return json({ error: "Comment can't be empty" }, { status: 400 });
    await db.update(comment).set({ body: text.slice(0, 5000), editedAt: new Date() }).where(eq(comment.id, c.id));
  }
  return json({ ok: true });
});

export const DELETE = withWorkspace<P>(async (_req, ctx, { id, commentId }) => {
  const c = await load(ctx.workspace.id, id, commentId);
  if (!c) return json({ error: "Not found" }, { status: 404 });
  if (c.authorUserId !== ctx.user.id && !ctx.isAdmin) return json({ error: "Not allowed" }, { status: 403 });
  await db.update(comment).set({ deletedAt: new Date() }).where(eq(comment.id, c.id));
  return json({ ok: true });
});
