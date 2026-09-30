import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channel, channelMember, user } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";
import { channelAccess } from "@/lib/chat";

type P = { slug: string; id: string };

export const GET = withWorkspace<P>(async (_req, ctx, { id }) => {
  const { channel: ch, member } = await channelAccess(ctx, id);
  const members = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(channelMember)
    .innerJoin(user, eq(user.id, channelMember.userId))
    .where(eq(channelMember.channelId, ch.id));
  return json({
    id: ch.id,
    kind: ch.kind,
    name: ch.name,
    topic: ch.topic,
    projectId: ch.projectId,
    isMember: !!member,
    isDefault: ch.isDefault,
    canManage: ctx.isAdmin || ch.createdBy === ctx.user.id,
    members,
  });
});

export const PATCH = withWorkspace<P>(async (req, ctx, { id }) => {
  const { channel: ch } = await channelAccess(ctx, id);
  if (!(ctx.isAdmin || ch.createdBy === ctx.user.id) || ch.kind === "dm")
    return json({ error: "Only the channel creator or an admin can change it" }, { status: 403 });
  const body = (await req.json()) as { topic?: string; archived?: boolean };
  await db
    .update(channel)
    .set({
      ...(typeof body.topic === "string" ? { topic: body.topic.slice(0, 250) } : {}),
      ...(typeof body.archived === "boolean" && !ch.isDefault && ch.kind !== "project" ? { archivedAt: body.archived ? new Date() : null } : {}),
    })
    .where(eq(channel.id, ch.id));
  return json({ ok: true });
});
