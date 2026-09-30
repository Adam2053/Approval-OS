"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { membership, user } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { saveLogo } from "@/lib/uploads";
import { normalizePhone } from "@/lib/utils";
import { fileUrl } from "@/lib/utils";

export async function updateProfileAction(slug: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 1) return { error: "Name is required" };
  let image: string | null | undefined;
  try {
    const key = await saveLogo(ctx.workspace.id, fd.get("avatar"));
    if (key) image = fileUrl(key);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await db
    .update(user)
    .set({ name, ...(image ? { image } : {}), updatedAt: new Date() })
    .where(eq(user.id, ctx.user.id));
  await db
    .update(membership)
    .set({
      designation: String(fd.get("designation") ?? "").trim() || null,
      phone: normalizePhone(String(fd.get("phone") ?? "")),
    })
    .where(eq(membership.id, ctx.membership.id));
  revalidatePath(`/w/${slug}`, "layout");
  return { ok: true, message: "Profile updated" };
}
