import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { message, reaction } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";
import { channelAccess } from "@/lib/chat";

const ALLOWED = new Set(["👍", "✅", "❤️", "😂", "🎉", "👀", "🙏", "🔥"]);

export const POST = withWorkspace<{ slug: string; id: string }>(async (req, ctx, { id }) => {
  const { emoji } = (await req.json()) as { emoji?: string };
  if (!emoji || !ALLOWED.has(emoji)) return json({ error: "Unsupported reaction" }, { status: 400 });
  const [m] = await db
    .select()
    .from(message)
    .where(and(eq(message.id, id), eq(message.workspaceId, ctx.workspace.id)));
  if (!m) return json({ error: "Not found" }, { status: 404 });
  await channelAccess(ctx, m.channelId);
  const where = and(eq(reaction.messageId, m.id), eq(reaction.userId, ctx.user.id), eq(reaction.emoji, emoji));
  const [existing] = await db.select().from(reaction).where(where);
  if (existing) await db.delete(reaction).where(where);
  else await db.insert(reaction).values({ messageId: m.id, userId: ctx.user.id, emoji });
  return json({ ok: true });
});
