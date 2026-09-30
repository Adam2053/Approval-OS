import "server-only";
import { eq, like } from "drizzle-orm";
import { db } from "@/db";
import { membership, workspace } from "@/db/schema";
import { createDefaultChannels } from "./events";
import { slugify } from "./utils";

async function uniqueSlug(name: string) {
  const base = slugify(name);
  const taken = await db.select({ slug: workspace.slug }).from(workspace).where(like(workspace.slug, `${base}%`));
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!set.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function createWorkspace(input: {
  name: string;
  userId: string;
  designation?: string | null;
  timezone?: string | null;
}) {
  const slug = await uniqueSlug(input.name);
  const [ws] = await db
    .insert(workspace)
    .values({
      name: input.name,
      slug,
      createdBy: input.userId,
      timezone: input.timezone || "Asia/Kolkata",
    })
    .returning();
  await db.insert(membership).values({
    workspaceId: ws!.id,
    userId: input.userId,
    role: "owner",
    designation: input.designation || "Founder",
  });
  await createDefaultChannels(ws!.id, input.userId);
  return ws!;
}

export async function userWorkspaces(userId: string) {
  return db
    .select({ id: workspace.id, name: workspace.name, slug: workspace.slug, logoKey: workspace.logoKey, role: membership.role })
    .from(membership)
    .innerJoin(workspace, eq(workspace.id, membership.workspaceId))
    .where(eq(membership.userId, userId))
    .orderBy(workspace.name);
}
