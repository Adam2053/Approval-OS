"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invitation, membership, type WorkspaceRole } from "@/db/schema";
import { emailLayout, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/events";
import { requireWorkspace } from "@/lib/session";
import { normalizePhone, randomToken } from "@/lib/utils";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["admin", "member"]).default("member"),
  designation: z.string().trim().max(60).optional().transform((v) => v || null),
});

export async function inviteMemberAction(slug: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  if (!ctx.isAdmin) return { error: "Only owners and admins can invite people." };
  const parsed = inviteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const token = randomToken(24);
  await db.insert(invitation).values({
    workspaceId: ctx.workspace.id,
    email: parsed.data.email,
    role: parsed.data.role,
    designation: parsed.data.designation,
    token,
    invitedBy: ctx.user.id,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
  const url = `${env.appUrl}/invite/${token}`;
  const { html, text } = emailLayout({
    brand: ctx.workspace.name,
    color: ctx.workspace.brandColor,
    heading: `Join ${ctx.workspace.name} on Approval OS`,
    lines: [
      `${ctx.user.name} invited you to join ${ctx.workspace.name}${parsed.data.designation ? ` as ${parsed.data.designation}` : ""}.`,
      "Approval OS is where the team shares work, chats, and collects client approvals.",
    ],
    cta: { label: "Accept invite", url },
  });
  await sendEmail({ to: parsed.data.email, subject: `${ctx.user.name} invited you to ${ctx.workspace.name}`, html, text });
  revalidatePath(`/w/${slug}/team`);
  return { ok: true, message: `Invite sent to ${parsed.data.email}. You can also copy the link from the pending list.` };
}

export async function revokeInviteAction(slug: string, inviteId: string) {
  const ctx = await requireWorkspace(slug);
  if (!ctx.isAdmin) return;
  await db
    .update(invitation)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitation.id, inviteId), eq(invitation.workspaceId, ctx.workspace.id), isNull(invitation.acceptedAt)));
  revalidatePath(`/w/${slug}/team`);
}

export async function updateMemberAction(slug: string, membershipId: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  const [m] = await db
    .select()
    .from(membership)
    .where(and(eq(membership.id, membershipId), eq(membership.workspaceId, ctx.workspace.id)));
  if (!m) return { error: "Member not found" };
  const self = m.userId === ctx.user.id;
  if (!ctx.isAdmin && !self) return { error: "You can only edit your own details." };
  const designation = String(fd.get("designation") ?? "").trim().slice(0, 60) || null;
  const phone = normalizePhone(String(fd.get("phone") ?? ""));
  let role = (String(fd.get("role") ?? m.role) as WorkspaceRole) || m.role;
  if (!["owner", "admin", "member"].includes(role)) role = m.role;
  if (!ctx.isAdmin) role = m.role;
  // Only owners can create or demote owners.
  if ((role === "owner" || m.role === "owner") && ctx.role !== "owner") role = m.role;
  if (m.role === "owner" && role !== "owner") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(membership)
      .where(and(eq(membership.workspaceId, ctx.workspace.id), eq(membership.role, "owner")));
    if (n <= 1) return { error: "A workspace needs at least one owner." };
  }
  await db.update(membership).set({ designation, phone, role }).where(eq(membership.id, m.id));
  revalidatePath(`/w/${slug}/team`);
  return { ok: true };
}

export async function removeMemberAction(slug: string, membershipId: string) {
  const ctx = await requireWorkspace(slug);
  const [m] = await db
    .select()
    .from(membership)
    .where(and(eq(membership.id, membershipId), eq(membership.workspaceId, ctx.workspace.id)));
  if (!m) return { error: "Not found" };
  const self = m.userId === ctx.user.id;
  if (!ctx.isAdmin && !self) return { error: "Not allowed" };
  if (m.role === "owner") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(membership)
      .where(and(eq(membership.workspaceId, ctx.workspace.id), eq(membership.role, "owner")));
    if (n <= 1) return { error: "Transfer ownership before removing the last owner." };
    if (ctx.role !== "owner") return { error: "Only owners can remove owners." };
  }
  await db.delete(membership).where(eq(membership.id, m.id));
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: self ? "member.left" : "member.removed",
    meta: { userId: m.userId },
  });
  revalidatePath(`/w/${slug}/team`);
  return { ok: true };
}
