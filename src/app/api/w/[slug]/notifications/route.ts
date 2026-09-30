import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";

export const GET = withWorkspace(async (_req, ctx) => {
  const where = and(eq(notification.userId, ctx.user.id), eq(notification.workspaceId, ctx.workspace.id));
  const items = await db.select().from(notification).where(where).orderBy(desc(notification.createdAt)).limit(30);
  const [{ n }] = await db.select({ n: count() }).from(notification).where(and(where, isNull(notification.readAt)));
  return json({
    unread: n,
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      body: i.body,
      link: i.link,
      readAt: i.readAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
  });
});

export const POST = withWorkspace(async (req, ctx) => {
  const body = (await req.json().catch(() => ({}))) as { all?: boolean; ids?: string[] };
  const where = and(eq(notification.userId, ctx.user.id), eq(notification.workspaceId, ctx.workspace.id), isNull(notification.readAt));
  if (body.all) await db.update(notification).set({ readAt: new Date() }).where(where);
  else if (body.ids?.length)
    await db.update(notification).set({ readAt: new Date() }).where(and(where, inArray(notification.id, body.ids)));
  return json({ ok: true });
});
