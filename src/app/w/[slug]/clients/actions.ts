"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { client, clientContact } from "@/db/schema";
import { logActivity } from "@/lib/events";
import { requireWorkspace } from "@/lib/session";
import { saveLogo } from "@/lib/uploads";
import { normalizePhone } from "@/lib/utils";

const opt = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null);

const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(120),
  industry: opt,
  website: opt,
  email: opt,
  phone: opt,
  address: opt,
  taxId: opt,
  notes: z.string().trim().max(5000).optional().transform((v) => v || null),
});

export async function createClientAction(slug: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  const parsed = clientSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  let logoKey: string | null = null;
  try {
    logoKey = await saveLogo(ctx.workspace.id, fd.get("logo"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const [c] = await db
    .insert(client)
    .values({ ...parsed.data, phone: normalizePhone(parsed.data.phone), logoKey, workspaceId: ctx.workspace.id, createdBy: ctx.user.id })
    .returning();
  // Optional first contact straight from the "new client" form.
  const contactName = String(fd.get("contactName") ?? "").trim();
  if (contactName) {
    await db.insert(clientContact).values({
      workspaceId: ctx.workspace.id,
      clientId: c!.id,
      name: contactName,
      email: String(fd.get("contactEmail") ?? "").trim().toLowerCase() || null,
      phone: normalizePhone(String(fd.get("contactPhone") ?? "")),
      designation: String(fd.get("contactDesignation") ?? "").trim() || null,
      isApprover: true,
    });
  }
  await logActivity({
    workspaceId: ctx.workspace.id,
    clientId: c!.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: "client.created",
    meta: { name: c!.name },
  });
  redirect(`/w/${slug}/clients/${c!.id}`);
}

export async function updateClientAction(slug: string, clientId: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  const parsed = clientSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  let logoKey: string | null = null;
  try {
    logoKey = await saveLogo(ctx.workspace.id, fd.get("logo"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  await db
    .update(client)
    .set({ ...parsed.data, phone: normalizePhone(parsed.data.phone), ...(logoKey ? { logoKey } : {}) })
    .where(and(eq(client.id, clientId), eq(client.workspaceId, ctx.workspace.id)));
  revalidatePath(`/w/${slug}/clients/${clientId}`);
  return { ok: true, message: "Saved" };
}

export async function setClientArchivedAction(slug: string, clientId: string, archived: boolean) {
  const ctx = await requireWorkspace(slug);
  await db
    .update(client)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(client.id, clientId), eq(client.workspaceId, ctx.workspace.id)));
  revalidatePath(`/w/${slug}/clients`);
  revalidatePath(`/w/${slug}/clients/${clientId}`);
}

export async function deleteClientAction(slug: string, clientId: string) {
  const ctx = await requireWorkspace(slug);
  if (!ctx.isAdmin) return { error: "Only admins can delete clients." };
  await db.delete(client).where(and(eq(client.id, clientId), eq(client.workspaceId, ctx.workspace.id)));
  redirect(`/w/${slug}/clients`);
}

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email"),
  phone: opt,
  designation: opt,
  isApprover: z.string().optional().transform((v) => v === "on" || v === "true"),
});

export async function saveContactAction(slug: string, clientId: string, contactId: string | null, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  const parsed = contactSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [c] = await db
    .select({ id: client.id })
    .from(client)
    .where(and(eq(client.id, clientId), eq(client.workspaceId, ctx.workspace.id)));
  if (!c) return { error: "Client not found" };
  const data = { ...parsed.data, phone: normalizePhone(parsed.data.phone) };
  if (contactId) {
    await db
      .update(clientContact)
      .set(data)
      .where(and(eq(clientContact.id, contactId), eq(clientContact.clientId, clientId)));
  } else {
    await db.insert(clientContact).values({ ...data, clientId, workspaceId: ctx.workspace.id });
  }
  revalidatePath(`/w/${slug}/clients/${clientId}`);
  return { ok: true };
}

export async function deleteContactAction(slug: string, clientId: string, contactId: string) {
  const ctx = await requireWorkspace(slug);
  await db
    .delete(clientContact)
    .where(
      and(eq(clientContact.id, contactId), eq(clientContact.clientId, clientId), eq(clientContact.workspaceId, ctx.workspace.id)),
    );
  revalidatePath(`/w/${slug}/clients/${clientId}`);
}
