"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { channelMember, client, decisionLog, membership, project, projectMember, type DecisionLogStatus, type ProjectStatus } from "@/db/schema";
import { ensureProjectChannel, logActivity, notifyUsers } from "@/lib/events";
import { canWorkOnProject, requireWorkspace } from "@/lib/session";

const dateOpt = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date");

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  startDate: dateOpt,
  dueDate: dateOpt,
  requireInternalApproval: z.string().optional().transform((v) => v === "on" || v === "true"),
});

async function workspaceMemberIds(workspaceId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.workspaceId, workspaceId), inArray(membership.userId, ids)));
  return rows.map((r) => r.userId);
}

async function syncChannelMembers(projectId: string, userIds: string[]) {
  const ch = await ensureProjectChannel(projectId);
  if (userIds.length)
    await db
      .insert(channelMember)
      .values(userIds.map((userId) => ({ channelId: ch.id, userId })))
      .onConflictDoNothing();
}

export async function createProjectAction(slug: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  const parsed = projectSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const clientId = String(fd.get("clientId") ?? "");
  const [c] = await db
    .select()
    .from(client)
    .where(and(eq(client.id, clientId), eq(client.workspaceId, ctx.workspace.id)));
  if (!c) return { error: "Choose a client" };
  const [p] = await db
    .insert(project)
    .values({ ...parsed.data, clientId, workspaceId: ctx.workspace.id, createdBy: ctx.user.id })
    .returning();
  const memberIds = await workspaceMemberIds(ctx.workspace.id, [
    ctx.user.id,
    ...fd.getAll("members").map(String),
  ]);
  await db
    .insert(projectMember)
    .values([...new Set(memberIds)].map((userId) => ({ projectId: p!.id, userId })))
    .onConflictDoNothing();
  await syncChannelMembers(p!.id, memberIds);
  await logActivity({
    workspaceId: ctx.workspace.id,
    projectId: p!.id,
    clientId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: "project.created",
    meta: { name: p!.name },
  });
  await notifyUsers({
    workspaceId: ctx.workspace.id,
    userIds: memberIds.filter((id) => id !== ctx.user.id),
    type: "project_added",
    title: `${ctx.user.name} added you to ${p!.name} (${c.name})`,
    link: `/w/${slug}/projects/${p!.id}`,
  });
  redirect(`/w/${slug}/projects/${p!.id}`);
}

export async function updateProjectAction(slug: string, projectId: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  if (!(await canWorkOnProject(ctx, projectId))) return { error: "Only project members or admins can edit this project." };
  const parsed = projectSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const status = String(fd.get("status") ?? "active") as ProjectStatus;
  await db
    .update(project)
    .set({ ...parsed.data, status: ["active", "on_hold", "completed", "archived"].includes(status) ? status : "active" })
    .where(and(eq(project.id, projectId), eq(project.workspaceId, ctx.workspace.id)));
  revalidatePath(`/w/${slug}/projects/${projectId}`);
  return { ok: true, message: "Project saved" };
}

export async function toggleInternalApprovalAction(slug: string, projectId: string, value: boolean) {
  const ctx = await requireWorkspace(slug);
  if (!(await canWorkOnProject(ctx, projectId))) return { error: "Not allowed" };
  await db
    .update(project)
    .set({ requireInternalApproval: value })
    .where(and(eq(project.id, projectId), eq(project.workspaceId, ctx.workspace.id)));
  revalidatePath(`/w/${slug}/projects/${projectId}`);
  return { ok: true };
}

export async function deleteProjectAction(slug: string, projectId: string) {
  const ctx = await requireWorkspace(slug);
  if (!ctx.isAdmin) return { error: "Only admins can delete projects." };
  await db.delete(project).where(and(eq(project.id, projectId), eq(project.workspaceId, ctx.workspace.id)));
  redirect(`/w/${slug}/projects`);
}

export async function addProjectMembersAction(slug: string, projectId: string, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  if (!(await canWorkOnProject(ctx, projectId))) return { error: "Only project members or admins can add people." };
  const ids = await workspaceMemberIds(ctx.workspace.id, fd.getAll("members").map(String));
  if (!ids.length) return { error: "Pick at least one teammate" };
  await db
    .insert(projectMember)
    .values(ids.map((userId) => ({ projectId, userId })))
    .onConflictDoNothing();
  await syncChannelMembers(projectId, ids);
  const [p] = await db.select().from(project).where(eq(project.id, projectId));
  await notifyUsers({
    workspaceId: ctx.workspace.id,
    userIds: ids.filter((id) => id !== ctx.user.id),
    type: "project_added",
    title: `${ctx.user.name} added you to ${p?.name}`,
    link: `/w/${slug}/projects/${projectId}`,
  });
  revalidatePath(`/w/${slug}/projects/${projectId}`);
  return { ok: true };
}

export async function removeProjectMemberAction(slug: string, projectId: string, userId: string) {
  const ctx = await requireWorkspace(slug);
  if (!(await canWorkOnProject(ctx, projectId))) return;
  await db.delete(projectMember).where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  revalidatePath(`/w/${slug}/projects/${projectId}`);
}

/* ------------------------------ Decision log ------------------------------ */

const decisionSchema = z.object({
  title: z.string().trim().min(1, "What was decided?").max(300),
  details: z.string().trim().max(5000).optional().transform((v) => v || null),
  status: z.enum(["proposed", "decided", "superseded"]).default("decided"),
  decidedBy: z.string().trim().max(200).optional().transform((v) => v || null),
  decidedAt: dateOpt,
});

export async function saveDecisionAction(slug: string, projectId: string, decisionId: string | null, fd: FormData) {
  const ctx = await requireWorkspace(slug);
  const [p] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, ctx.workspace.id)));
  if (!p) return { error: "Project not found" };
  const parsed = decisionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const values = {
    ...parsed.data,
    decidedBy: parsed.data.decidedBy ?? ctx.user.name,
    decidedAt: parsed.data.decidedAt ?? new Date(),
  };
  if (decisionId) {
    await db
      .update(decisionLog)
      .set(values)
      .where(and(eq(decisionLog.id, decisionId), eq(decisionLog.projectId, projectId)));
  } else {
    await db.insert(decisionLog).values({
      ...values,
      workspaceId: ctx.workspace.id,
      projectId,
      createdBy: ctx.user.id,
      source: "manual",
      messageId: (fd.get("messageId") as string) || null,
    });
  }
  revalidatePath(`/w/${slug}/projects/${projectId}`);
  return { ok: true };
}

export async function setDecisionStatusAction(slug: string, projectId: string, decisionId: string, status: DecisionLogStatus) {
  const ctx = await requireWorkspace(slug);
  await db
    .update(decisionLog)
    .set({ status })
    .where(and(eq(decisionLog.id, decisionId), eq(decisionLog.projectId, projectId), eq(decisionLog.workspaceId, ctx.workspace.id)));
  revalidatePath(`/w/${slug}/projects/${projectId}`);
}

export async function deleteDecisionAction(slug: string, projectId: string, decisionId: string) {
  const ctx = await requireWorkspace(slug);
  await db
    .delete(decisionLog)
    .where(and(eq(decisionLog.id, decisionId), eq(decisionLog.projectId, projectId), eq(decisionLog.workspaceId, ctx.workspace.id)));
  revalidatePath(`/w/${slug}/projects/${projectId}`);
}
