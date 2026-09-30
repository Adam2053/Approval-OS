import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lt, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalRequest,
  asset,
  client,
  clientContact,
  membership,
  project,
  projectMember,
  user,
  version,
  type ApprovalStatus,
} from "@/db/schema";
import { fileUrl } from "./utils";

export async function workspaceMembers(workspaceId: string) {
  const rows = await db
    .select({
      membershipId: membership.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: membership.role,
      designation: membership.designation,
      phone: membership.phone,
      joinedAt: membership.createdAt,
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.workspaceId, workspaceId))
    .orderBy(asc(user.name));
  return rows;
}

export async function clientsWithStats(workspaceId: string, includeArchived = false) {
  const clients = await db
    .select()
    .from(client)
    .where(and(eq(client.workspaceId, workspaceId), includeArchived ? undefined : isNull(client.archivedAt)))
    .orderBy(asc(client.name));
  const ids = clients.map((c) => c.id);
  if (!ids.length) return [];
  const projectCounts = await db
    .select({ clientId: project.clientId, n: count() })
    .from(project)
    .where(inArray(project.clientId, ids))
    .groupBy(project.clientId);
  const openCounts = await db
    .select({ clientId: approvalRequest.clientId, n: count() })
    .from(approvalRequest)
    .where(and(inArray(approvalRequest.clientId, ids), notInArray(approvalRequest.status, ["approved", "cancelled"])))
    .groupBy(approvalRequest.clientId);
  const contactCounts = await db
    .select({ clientId: clientContact.clientId, n: count() })
    .from(clientContact)
    .where(inArray(clientContact.clientId, ids))
    .groupBy(clientContact.clientId);
  const m = (rows: { clientId: string; n: number }[]) => new Map(rows.map((r) => [r.clientId, r.n]));
  const pc = m(projectCounts);
  const oc = m(openCounts);
  const cc = m(contactCounts);
  return clients.map((c) => ({
    ...c,
    logoUrl: fileUrl(c.logoKey),
    projects: pc.get(c.id) ?? 0,
    openApprovals: oc.get(c.id) ?? 0,
    contacts: cc.get(c.id) ?? 0,
  }));
}

export async function projectsList(workspaceId: string, opts: { clientId?: string; userId?: string; includeArchived?: boolean } = {}) {
  const where: (SQL | undefined)[] = [eq(project.workspaceId, workspaceId)];
  if (opts.clientId) where.push(eq(project.clientId, opts.clientId));
  if (!opts.includeArchived) where.push(sql`${project.status} <> 'archived'`);
  if (opts.userId)
    where.push(
      inArray(
        project.id,
        db.select({ id: projectMember.projectId }).from(projectMember).where(eq(projectMember.userId, opts.userId)),
      ),
    );
  const rows = await db
    .select({ project, clientName: client.name, clientLogo: client.logoKey })
    .from(project)
    .innerJoin(client, eq(client.id, project.clientId))
    .where(and(...where))
    .orderBy(desc(project.createdAt));
  const ids = rows.map((r) => r.project.id);
  if (!ids.length) return [];
  const members = await db
    .select({ projectId: projectMember.projectId, userId: user.id, name: user.name, image: user.image })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .where(inArray(projectMember.projectId, ids));
  const stats = await db
    .select({ projectId: approvalRequest.projectId, status: approvalRequest.status, n: count() })
    .from(approvalRequest)
    .where(inArray(approvalRequest.projectId, ids))
    .groupBy(approvalRequest.projectId, approvalRequest.status);
  return rows.map((r) => {
    const s = stats.filter((x) => x.projectId === r.project.id);
    const total = s.reduce((a, b) => a + b.n, 0);
    const approved = s.find((x) => x.status === "approved")?.n ?? 0;
    const open = s.filter((x) => !["approved", "cancelled"].includes(x.status)).reduce((a, b) => a + b.n, 0);
    return {
      ...r.project,
      clientName: r.clientName,
      clientLogoUrl: fileUrl(r.clientLogo),
      members: members.filter((m) => m.projectId === r.project.id),
      total,
      approved,
      open,
    };
  });
}

export type RequestListItem = Awaited<ReturnType<typeof requestsList>>[number];

export async function requestsList(
  workspaceId: string,
  opts: {
    projectId?: string;
    clientId?: string;
    statuses?: ApprovalStatus[];
    overdue?: boolean;
    createdBy?: string;
    memberOf?: string;
    q?: string;
    limit?: number;
  } = {},
) {
  const where: (SQL | undefined)[] = [eq(approvalRequest.workspaceId, workspaceId)];
  if (opts.projectId) where.push(eq(approvalRequest.projectId, opts.projectId));
  if (opts.clientId) where.push(eq(approvalRequest.clientId, opts.clientId));
  if (opts.statuses?.length) where.push(inArray(approvalRequest.status, opts.statuses));
  if (opts.createdBy) where.push(eq(approvalRequest.createdBy, opts.createdBy));
  if (opts.overdue) {
    where.push(lt(approvalRequest.dueAt, new Date()));
    where.push(notInArray(approvalRequest.status, ["approved", "cancelled"]));
  }
  if (opts.memberOf)
    where.push(
      inArray(
        approvalRequest.projectId,
        db.select({ id: projectMember.projectId }).from(projectMember).where(eq(projectMember.userId, opts.memberOf)),
      ),
    );
  if (opts.q) where.push(sql`${approvalRequest.title} ilike ${"%" + opts.q + "%"}`);

  const rows = await db
    .select({
      request: approvalRequest,
      projectName: project.name,
      clientName: client.name,
      creatorName: user.name,
      creatorImage: user.image,
    })
    .from(approvalRequest)
    .innerJoin(project, eq(project.id, approvalRequest.projectId))
    .innerJoin(client, eq(client.id, approvalRequest.clientId))
    .leftJoin(user, eq(user.id, approvalRequest.createdBy))
    .where(and(...where))
    .orderBy(desc(approvalRequest.updatedAt))
    .limit(opts.limit ?? 200);

  const ids = rows.map((r) => r.request.id);
  const thumbs = ids.length
    ? await db
        .select({ requestId: asset.requestId, number: version.number, key: asset.thumbKey, storageKey: asset.storageKey, position: asset.position })
        .from(asset)
        .innerJoin(version, eq(version.id, asset.versionId))
        .where(inArray(asset.requestId, ids))
        .orderBy(desc(version.number), asc(asset.position))
    : [];
  const thumbOf = new Map<string, { url: string; count: number }>();
  for (const t of thumbs) {
    const cur = thumbOf.get(t.requestId);
    if (!cur) thumbOf.set(t.requestId, { url: fileUrl(t.key ?? t.storageKey)!, count: 1 });
    else if (thumbs.find((x) => x.requestId === t.requestId)?.number === t.number) cur.count++;
  }
  return rows.map((r) => ({
    id: r.request.id,
    title: r.request.title,
    status: r.request.status,
    platform: r.request.platform,
    dueAt: r.request.dueAt,
    updatedAt: r.request.updatedAt,
    currentVersion: r.request.currentVersion,
    projectId: r.request.projectId,
    projectName: r.projectName,
    clientName: r.clientName,
    creatorName: r.creatorName,
    creatorImage: r.creatorImage,
    thumbUrl: thumbOf.get(r.request.id)?.url ?? null,
    imageCount: thumbOf.get(r.request.id)?.count ?? 0,
  }));
}
