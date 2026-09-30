import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { membership } from "@/db/schema";
import { json, withWorkspace } from "@/lib/api";
import { getOrCreateDm } from "@/lib/chat";

export const POST = withWorkspace(async (req, ctx) => {
  const body = (await req.json()) as { userIds?: string[] };
  const ids = (body.userIds ?? []).slice(0, 8);
  const valid = ids.length
    ? (
        await db
          .select({ userId: membership.userId })
          .from(membership)
          .where(and(eq(membership.workspaceId, ctx.workspace.id), inArray(membership.userId, ids)))
      ).map((m) => m.userId)
    : [];
  const ch = await getOrCreateDm(ctx, valid);
  return json({ id: ch.id });
});
