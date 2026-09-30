import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { channelMember } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";
import { channelAccess } from "@/lib/chat";

export const POST = withWorkspace<{ slug: string; id: string }>(async (_req, ctx, { id }) => {
  const { channel: ch, member } = await channelAccess(ctx, id);
  if (member)
    await db
      .update(channelMember)
      .set({ lastReadAt: new Date() })
      .where(and(eq(channelMember.channelId, ch.id), eq(channelMember.userId, ctx.user.id)));
  return json({ ok: true });
});
