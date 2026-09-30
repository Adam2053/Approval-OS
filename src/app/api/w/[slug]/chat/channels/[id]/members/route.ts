import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { channelMember, membership } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";
import { channelAccess } from "@/lib/chat";

type P = { slug: string; id: string };

/** Join (no body) or add people ({ userIds }). */
export const POST = withWorkspace<P>(async (req, ctx, { id }) => {
  const { channel: ch, member } = await channelAccess(ctx, id);
  const body = (await req.json().catch(() => ({}))) as { userIds?: string[] };
  const ids = body.userIds?.length ? body.userIds : [ctx.user.id];
  if (ch.kind === "dm") return json({ error: "Start a new group message instead" }, { status: 400 });
  if (ids.some((x) => x !== ctx.user.id) && !member && !ctx.isAdmin)
    return json({ error: "Join the channel before adding people" }, { status: 403 });
  const valid = (
    await db
      .select({ userId: membership.userId })
      .from(membership)
      .where(and(eq(membership.workspaceId, ctx.workspace.id), inArray(membership.userId, ids)))
  ).map((m) => m.userId);
  if (valid.length)
    await db
      .insert(channelMember)
      .values(valid.map((userId) => ({ channelId: ch.id, userId })))
      .onConflictDoNothing();
  return json({ ok: true });
});

/** Leave the channel. */
export const DELETE = withWorkspace<P>(async (_req, ctx, { id }) => {
  const { channel: ch } = await channelAccess(ctx, id);
  if (ch.kind === "dm") return json({ error: "You can’t leave a direct message" }, { status: 400 });
  await db.delete(channelMember).where(and(eq(channelMember.channelId, ch.id), eq(channelMember.userId, ctx.user.id)));
  return json({ ok: true });
});
