import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalRequest,
  channel,
  channelMember,
  message,
  project,
  projectMember,
  reaction,
  user,
  type Attachment,
} from "@/db/schema";
import { mentionedIds } from "./comments";
import { notifyUsers } from "./events";
import { HttpError } from "./api";
import type { WorkspaceContext } from "./session";
import { fileUrl } from "./utils";

type Channel = typeof channel.$inferSelect;

export async function channelAccess(ctx: WorkspaceContext, channelId: string) {
  const [ch] = await db
    .select()
    .from(channel)
    .where(and(eq(channel.id, channelId), eq(channel.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!ch) throw new HttpError(404, "Channel not found");
  const [member] = await db
    .select()
    .from(channelMember)
    .where(and(eq(channelMember.channelId, ch.id), eq(channelMember.userId, ctx.user.id)))
    .limit(1);
  let canRead = false;
  if (ch.kind === "public") canRead = true;
  else if (ch.kind === "private" || ch.kind === "dm") canRead = !!member;
  else if (ch.kind === "project" && ch.projectId) {
    const [pm] = await db
      .select()
      .from(projectMember)
      .where(and(eq(projectMember.projectId, ch.projectId), eq(projectMember.userId, ctx.user.id)))
      .limit(1);
    canRead = ctx.isAdmin || !!pm || !!member;
  }
  if (!canRead) throw new HttpError(403, "You don’t have access to this conversation");
  return { channel: ch, member: member ?? null };
}

/** Joins a readable channel on first visit so read-tracking works. */
export async function ensureMember(channelId: string, userId: string) {
  await db.insert(channelMember).values({ channelId, userId }).onConflictDoNothing();
}

export async function listChannels(ctx: WorkspaceContext) {
  const uid = ctx.user.id;
  const myProjects = db.select({ id: projectMember.projectId }).from(projectMember).where(eq(projectMember.userId, uid));
  const rows = await db
    .select({ channel, lastReadAt: channelMember.lastReadAt, memberUserId: channelMember.userId, projectName: project.name })
    .from(channel)
    .leftJoin(channelMember, and(eq(channelMember.channelId, channel.id), eq(channelMember.userId, uid)))
    .leftJoin(project, eq(project.id, channel.projectId))
    .where(
      and(
        eq(channel.workspaceId, ctx.workspace.id),
        isNull(channel.archivedAt),
        or(
          eq(channel.kind, "public"),
          eq(channelMember.userId, uid),
          ctx.isAdmin ? eq(channel.kind, "project") : and(eq(channel.kind, "project"), inArray(channel.projectId, myProjects)),
        ),
      ),
    )
    .orderBy(asc(channel.name));

  const ids = rows.map((r) => r.channel.id);
  const unreadRows = ids.length
    ? await db
        .select({ channelId: message.channelId, n: sql<number>`count(*)::int` })
        .from(message)
        .innerJoin(channelMember, and(eq(channelMember.channelId, message.channelId), eq(channelMember.userId, uid)))
        .where(
          and(
            inArray(message.channelId, ids),
            isNull(message.parentId),
            isNull(message.deletedAt),
            gt(message.createdAt, channelMember.lastReadAt),
            or(isNull(message.userId), ne(message.userId, uid)),
          ),
        )
        .groupBy(message.channelId)
    : [];
  const unread = new Map(unreadRows.map((r) => [r.channelId, r.n]));

  // DM display names: the other participant(s).
  const dmIds = rows.filter((r) => r.channel.kind === "dm").map((r) => r.channel.id);
  const dmMembers = dmIds.length
    ? await db
        .select({ channelId: channelMember.channelId, userId: user.id, name: user.name, image: user.image })
        .from(channelMember)
        .innerJoin(user, eq(user.id, channelMember.userId))
        .where(inArray(channelMember.channelId, dmIds))
    : [];

  return rows.map((r) => {
    const others = dmMembers.filter((m) => m.channelId === r.channel.id && m.userId !== uid);
    return {
      id: r.channel.id,
      kind: r.channel.kind,
      name:
        r.channel.kind === "dm"
          ? others.map((o) => o.name).join(", ") || "Just you"
          : r.channel.kind === "project"
            ? (r.projectName ?? r.channel.name)
            : r.channel.name,
      topic: r.channel.topic,
      projectId: r.channel.projectId,
      isMember: !!r.memberUserId,
      unread: unread.get(r.channel.id) ?? 0,
      lastMessageAt: r.channel.lastMessageAt?.toISOString() ?? null,
      dmUser: r.channel.kind === "dm" ? (others[0] ?? null) : null,
    };
  });
}

export async function totalUnread(ctx: WorkspaceContext) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(message)
    .innerJoin(channelMember, and(eq(channelMember.channelId, message.channelId), eq(channelMember.userId, ctx.user.id)))
    .innerJoin(channel, eq(channel.id, message.channelId))
    .where(
      and(
        eq(message.workspaceId, ctx.workspace.id),
        isNull(channel.archivedAt),
        isNull(message.parentId),
        isNull(message.deletedAt),
        gt(message.createdAt, channelMember.lastReadAt),
        or(isNull(message.userId), ne(message.userId, ctx.user.id)),
      ),
    );
  return row?.n ?? 0;
}

export type ChatMessage = Awaited<ReturnType<typeof serializeMessages>>[number];

async function serializeMessages(rows: (typeof message.$inferSelect)[], meId: string) {
  const ids = rows.map((m) => m.id);
  const userIds = [...new Set(rows.map((m) => m.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await db.select({ id: user.id, name: user.name, image: user.image }).from(user).where(inArray(user.id, userIds))
    : [];
  const reactions = ids.length
    ? await db
        .select({ messageId: reaction.messageId, emoji: reaction.emoji, userId: reaction.userId, name: user.name })
        .from(reaction)
        .innerJoin(user, eq(user.id, reaction.userId))
        .where(inArray(reaction.messageId, ids))
        .orderBy(asc(reaction.createdAt))
    : [];
  const requestIds = [...new Set(rows.map((m) => m.requestId).filter(Boolean))] as string[];
  const requests = requestIds.length
    ? await db
        .select({ id: approvalRequest.id, title: approvalRequest.title, status: approvalRequest.status })
        .from(approvalRequest)
        .where(inArray(approvalRequest.id, requestIds))
    : [];
  const userOf = new Map(users.map((u) => [u.id, u]));
  return rows.map((m) => {
    const grouped = new Map<string, { emoji: string; count: number; mine: boolean; names: string[] }>();
    for (const r of reactions.filter((x) => x.messageId === m.id)) {
      const g = grouped.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
      g.count++;
      g.names.push(r.name);
      if (r.userId === meId) g.mine = true;
      grouped.set(r.emoji, g);
    }
    const u = m.userId ? userOf.get(m.userId) : null;
    return {
      id: m.id,
      body: m.deletedAt ? "" : m.body,
      deleted: !!m.deletedAt,
      system: m.system,
      user: u ? { id: u.id, name: u.name, image: u.image } : null,
      mine: m.userId === meId,
      parentId: m.parentId,
      replyCount: m.replyCount,
      lastReplyAt: m.lastReplyAt?.toISOString() ?? null,
      editedAt: m.editedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      attachments: m.deletedAt
        ? []
        : (m.attachments as Attachment[]).map((a) => ({ ...a, url: fileUrl(a.key)! })),
      reactions: [...grouped.values()],
      request: m.requestId ? (requests.find((r) => r.id === m.requestId) ?? null) : null,
    };
  });
}

export async function listMessages(ch: Channel, meId: string, opts: { before?: string; parentId?: string }) {
  if (opts.parentId) {
    const rows = await db
      .select()
      .from(message)
      .where(and(eq(message.channelId, ch.id), or(eq(message.id, opts.parentId), eq(message.parentId, opts.parentId))))
      .orderBy(asc(message.createdAt))
      .limit(500);
    return { messages: await serializeMessages(rows, meId), hasMore: false };
  }
  const limit = 60;
  const rows = await db
    .select()
    .from(message)
    .where(
      and(
        eq(message.channelId, ch.id),
        isNull(message.parentId),
        opts.before ? lt(message.createdAt, new Date(opts.before)) : undefined,
      ),
    )
    .orderBy(desc(message.createdAt))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  return { messages: await serializeMessages(page, meId), hasMore };
}

export async function postMessage(
  ctx: WorkspaceContext,
  ch: Channel,
  input: { body: string; parentId?: string | null; attachments?: Attachment[] },
) {
  const body = input.body.trim().slice(0, 10000);
  const prefix = `ws/${ctx.workspace.id}/`;
  const attachments = (input.attachments ?? []).filter((a) => a.key.startsWith(prefix)).slice(0, 10);
  if (!body && attachments.length === 0) throw new HttpError(400, "Message is empty");
  if (input.parentId) {
    const [parent] = await db
      .select({ id: message.id })
      .from(message)
      .where(and(eq(message.id, input.parentId), eq(message.channelId, ch.id), isNull(message.parentId)));
    if (!parent) throw new HttpError(400, "Thread not found");
  }
  const now = new Date();
  const [m] = await db
    .insert(message)
    .values({
      workspaceId: ctx.workspace.id,
      channelId: ch.id,
      userId: ctx.user.id,
      parentId: input.parentId ?? null,
      body,
      attachments,
      createdAt: now,
    })
    .returning();
  if (input.parentId) {
    await db
      .update(message)
      .set({ replyCount: sql`${message.replyCount} + 1`, lastReplyAt: now })
      .where(eq(message.id, input.parentId));
  } else {
    await db.update(channel).set({ lastMessageAt: now }).where(eq(channel.id, ch.id));
  }
  await ensureMember(ch.id, ctx.user.id);
  await db
    .update(channelMember)
    .set({ lastReadAt: now })
    .where(and(eq(channelMember.channelId, ch.id), eq(channelMember.userId, ctx.user.id)));

  const mentioned = mentionedIds(body).filter((id) => id !== ctx.user.id);
  if (mentioned.length) {
    const where = ch.kind === "dm" ? "a direct message" : ch.kind === "project" ? `the ${ch.name} discussion` : `#${ch.name}`;
    await notifyUsers({
      workspaceId: ctx.workspace.id,
      userIds: mentioned,
      type: "mention",
      title: `${ctx.user.name} mentioned you in ${where}`,
      body: body.replace(/<@[\w-]+>/g, "@…").slice(0, 200),
      link: ch.kind === "project" && ch.projectId ? `/w/${ctx.workspace.slug}/projects/${ch.projectId}?tab=discussion` : `/w/${ctx.workspace.slug}/chat/${ch.id}`,
    });
  }
  return m!;
}

export async function getOrCreateDm(ctx: WorkspaceContext, otherUserIds: string[]) {
  const ids = [...new Set([ctx.user.id, ...otherUserIds])].sort();
  const dmKey = ids.join(":");
  const [existing] = await db
    .select()
    .from(channel)
    .where(and(eq(channel.workspaceId, ctx.workspace.id), eq(channel.dmKey, dmKey)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(channel)
    .values({ workspaceId: ctx.workspace.id, kind: "dm", name: "dm", dmKey, createdBy: ctx.user.id })
    .onConflictDoNothing()
    .returning();
  const ch =
    created ??
    (await db.select().from(channel).where(and(eq(channel.workspaceId, ctx.workspace.id), eq(channel.dmKey, dmKey))).limit(1))[0]!;
  await db
    .insert(channelMember)
    .values(ids.map((userId) => ({ channelId: ch.id, userId })))
    .onConflictDoNothing();
  return ch;
}
