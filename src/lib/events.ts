import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  activity,
  channel,
  channelMember,
  membership,
  message,
  notification,
  project,
  projectMember,
  user,
} from "@/db/schema";
import { emailLayout, sendEmail } from "./email";
import { env } from "./env";

export async function logActivity(input: typeof activity.$inferInsert) {
  await db.insert(activity).values(input);
}

type NotifyInput = {
  workspaceId: string;
  userIds: string[];
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Also send an email to each user. */
  email?: boolean;
  brand?: { name: string; color: string };
};

/** In-app notification (+ optional email) for a set of teammates. Deduplicates ids. */
export async function notifyUsers(n: NotifyInput) {
  const ids = [...new Set(n.userIds)].filter(Boolean);
  if (ids.length === 0) return;
  await db.insert(notification).values(
    ids.map((userId) => ({
      workspaceId: n.workspaceId,
      userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
    })),
  );
  if (n.email) {
    const users = await db.select({ email: user.email, name: user.name }).from(user).where(inArray(user.id, ids));
    const { html, text } = emailLayout({
      brand: n.brand?.name,
      color: n.brand?.color,
      heading: n.title,
      lines: n.body ? [n.body] : [],
      cta: n.link ? { label: "Open in Approval OS", url: `${env.appUrl}${n.link}` } : undefined,
    });
    await Promise.all(users.map((u) => sendEmail({ to: u.email, subject: n.title, html, text })));
  }
}

export async function workspaceAdminIds(workspaceId: string) {
  const rows = await db
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.workspaceId, workspaceId), inArray(membership.role, ["owner", "admin"])));
  return rows.map((r) => r.userId);
}

export async function projectMemberIds(projectId: string) {
  const rows = await db.select({ userId: projectMember.userId }).from(projectMember).where(eq(projectMember.projectId, projectId));
  return rows.map((r) => r.userId);
}

/** Ensures a project has its discussion channel, creating it on first use. */
export async function ensureProjectChannel(projectId: string) {
  const existing = await db.select().from(channel).where(eq(channel.projectId, projectId)).limit(1);
  if (existing[0]) return existing[0];
  const [p] = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
  if (!p) throw new Error("Project not found");
  const [created] = await db
    .insert(channel)
    .values({
      workspaceId: p.workspaceId,
      kind: "project",
      name: p.name,
      topic: "Project discussion",
      projectId: p.id,
      createdBy: p.createdBy,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(channel).where(eq(channel.projectId, projectId)).limit(1);
  return again!;
}

/** Posts an automatic (system) message into a project's discussion channel. */
export async function postProjectSystemMessage(projectId: string, body: string, requestId?: string) {
  const ch = await ensureProjectChannel(projectId);
  const now = new Date();
  await db.insert(message).values({
    workspaceId: ch.workspaceId,
    channelId: ch.id,
    body,
    system: true,
    requestId: requestId ?? null,
    createdAt: now,
  });
  await db.update(channel).set({ lastMessageAt: now }).where(eq(channel.id, ch.id));
}

/** Creates the default #general channel for a new workspace. */
export async function createDefaultChannels(workspaceId: string, userId: string) {
  const existing = await db
    .select({ id: channel.id })
    .from(channel)
    .where(and(eq(channel.workspaceId, workspaceId), eq(channel.isDefault, true), isNull(channel.archivedAt)))
    .limit(1);
  if (existing[0]) return;
  const [general] = await db
    .insert(channel)
    .values([
      {
        workspaceId,
        kind: "public",
        name: "general",
        topic: "Company-wide announcements and chatter",
        isDefault: true,
        createdBy: userId,
      },
      {
        workspaceId,
        kind: "public",
        name: "approvals",
        topic: "Heads-up on approvals going out and coming back",
        createdBy: userId,
      },
    ])
    .returning();
  await db.insert(channelMember).values({ channelId: general!.id, userId }).onConflictDoNothing();
}
