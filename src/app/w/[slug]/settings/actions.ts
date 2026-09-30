"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { saveLogo } from "@/lib/uploads";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color"),
  timezone: z.string().trim().min(1).max(60),
});

export async function updateWorkspaceAction(slug: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  if (!ctx.isAdmin) return { error: "Only owners and admins can change settings." };
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  let logoKey: string | null = null;
  try {
    logoKey = await saveLogo(ctx.workspace.id, fd.get("logo"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  await db
    .update(workspace)
    .set({ ...parsed.data, ...(logoKey ? { logoKey } : {}), ...(fd.get("removeLogo") === "on" ? { logoKey: null } : {}) })
    .where(eq(workspace.id, ctx.workspace.id));
  revalidatePath(`/w/${slug}`, "layout");
  return { ok: true, message: "Settings saved" };
}

export async function deleteWorkspaceAction(slug: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  if (ctx.role !== "owner") return { error: "Only owners can delete the workspace." };
  if (String(fd.get("confirm") ?? "") !== ctx.workspace.name) return { error: "Type the workspace name exactly to confirm." };
  await db.delete(workspace).where(eq(workspace.id, ctx.workspace.id));
  redirect("/app");
}
