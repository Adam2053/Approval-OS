import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { message } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";
import { channelAccess } from "@/lib/chat";

type P = { slug: string; id: string };

async function load(workspaceId: string, id: string) {
  const [m] = await db
    .select()
    .from(message)
    .where(and(eq(message.id, id), eq(message.workspaceId, workspaceId)));
  return m ?? null;
}

export const PATCH = withWorkspace<P>(async (req, ctx, { id }) => {
  const m = await load(ctx.workspace.id, id);
  if (!m || m.deletedAt) return json({ error: "Not found" }, { status: 404 });
  await channelAccess(ctx, m.channelId);
  if (m.userId !== ctx.user.id) return json({ error: "You can only edit your own messages" }, { status: 403 });
  const { body } = (await req.json()) as { body?: string };
  const text = (body ?? "").trim();
  if (!text) return json({ error: "Message can’t be empty" }, { status: 400 });
  await db.update(message).set({ body: text.slice(0, 10000), editedAt: new Date() }).where(eq(message.id, m.id));
  return json({ ok: true });
});

export const DELETE = withWorkspace<P>(async (_req, ctx, { id }) => {
  const m = await load(ctx.workspace.id, id);
  if (!m) return json({ error: "Not found" }, { status: 404 });
  await channelAccess(ctx, m.channelId);
  if (m.userId !== ctx.user.id && !ctx.isAdmin) return json({ error: "Not allowed" }, { status: 403 });
  await db.update(message).set({ deletedAt: new Date() }).where(eq(message.id, m.id));
  return json({ ok: true });
});
