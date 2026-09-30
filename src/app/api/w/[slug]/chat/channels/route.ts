import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { channel, channelMember, membership } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";
import { listChannels } from "@/lib/chat";

export const GET = withWorkspace(async (_req, ctx) => json({ channels: await listChannels(ctx) }));

const schema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Name the channel")
    .max(60)
    .transform((s) => s.replace(/^#/, "").replace(/\s+/g, "-").replace(/[^\w-]/g, "")),
  topic: z.string().trim().max(250).optional(),
  kind: z.enum(["public", "private"]).default("public"),
  memberIds: z.array(z.string()).default([]),
});

export const POST = withWorkspace(async (req, ctx) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const d = parsed.data;
  if (!d.name) return json({ error: "Use letters or numbers in the name" }, { status: 400 });
  const [dupe] = await db
    .select({ id: channel.id })
    .from(channel)
    .where(and(eq(channel.workspaceId, ctx.workspace.id), eq(channel.name, d.name), inArray(channel.kind, ["public", "private"])));
  if (dupe) return json({ error: `#${d.name} already exists` }, { status: 400 });
  const [ch] = await db
    .insert(channel)
    .values({ workspaceId: ctx.workspace.id, kind: d.kind, name: d.name, topic: d.topic || null, createdBy: ctx.user.id })
    .returning();
  const valid = d.memberIds.length
    ? (
        await db
          .select({ userId: membership.userId })
          .from(membership)
          .where(and(eq(membership.workspaceId, ctx.workspace.id), inArray(membership.userId, d.memberIds)))
      ).map((m) => m.userId)
    : [];
  await db
    .insert(channelMember)
    .values([...new Set([ctx.user.id, ...valid])].map((userId) => ({ channelId: ch!.id, userId })))
    .onConflictDoNothing();
  return json({ id: ch!.id });
});
