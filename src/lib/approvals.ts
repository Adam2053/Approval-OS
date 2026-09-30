import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  activity,
  approvalRecipient,
  approvalRequest,
  asset,
  client,
  clientContact,
  comment,
  decision,
  decisionLog,
  membership,
  project,
  reviewer,
  user,
  version,
  workspace,
  type Annotation,
  type ApprovalStatus,
} from "@/db/schema";
import { emailLayout, sendEmail } from "./email";
import { env } from "./env";
import {
  logActivity,
  notifyUsers,
  postProjectSystemMessage,
  projectMemberIds,
  workspaceAdminIds,
} from "./events";
import { isProjectMember, type WorkspaceContext } from "./session";
import { STATUS_META } from "./status";
import { fileUrl, randomToken } from "./utils";

export type RequestRow = typeof approvalRequest.$inferSelect;

export function requestLink(slug: string, requestId: string) {
  return `/w/${slug}/approvals/${requestId}`;
}

export function reviewUrl(token: string, accessKey?: string) {
  return `${env.appUrl}/r/${token}${accessKey ? `?k=${accessKey}` : ""}`;
}

export async function loadRequest(ctx: WorkspaceContext, requestId: string) {
  const rows = await db
    .select({ request: approvalRequest, project, client })
    .from(approvalRequest)
    .innerJoin(project, eq(project.id, approvalRequest.projectId))
    .innerJoin(client, eq(client.id, approvalRequest.clientId))
    .where(and(eq(approvalRequest.id, requestId), eq(approvalRequest.workspaceId, ctx.workspace.id)))
    .limit(1);
  return rows[0] ?? null;
}

async function latestVersion(requestId: string) {
  const [v] = await db
    .select()
    .from(version)
    .where(eq(version.requestId, requestId))
    .orderBy(desc(version.number))
    .limit(1);
  return v ?? null;
}

async function setStatus(requestId: string, status: ApprovalStatus, extra: Partial<RequestRow> = {}) {
  await db
    .update(approvalRequest)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(approvalRequest.id, requestId));
}

/* -------------------------------------------------------------------------- */
/*                                Permissions                                  */
/* -------------------------------------------------------------------------- */

export async function teamPermissions(ctx: WorkspaceContext, req: RequestRow) {
  const member = await isProjectMember(req.projectId, ctx.user.id);
  const canWork = ctx.isAdmin || member;
  const latest = await latestVersion(req.id);
  // Admins can approve their own work (small teams); other members need a second pair of eyes.
  const canInternalApprove =
    req.status === "internal_review" && (ctx.isAdmin || (member && latest?.createdBy !== ctx.user.id));
  return {
    canWork,
    canInternalApprove,
    canCancel: ctx.isAdmin || req.createdBy === ctx.user.id,
  };
}

/* -------------------------------------------------------------------------- */
/*                                Transitions                                  */
/* -------------------------------------------------------------------------- */

export type AssetInput = {
  key: string;
  thumbKey?: string | null;
  name: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
};

function validAssets(ctx: WorkspaceContext, assets: AssetInput[]) {
  const prefix = `ws/${ctx.workspace.id}/`;
  return assets.filter(
    (a) => a.key.startsWith(prefix) && (!a.thumbKey || a.thumbKey.startsWith(prefix)) && a.mimeType.startsWith("image/"),
  );
}

export async function createRequest(
  ctx: WorkspaceContext,
  input: {
    projectId: string;
    title: string;
    brief?: string | null;
    caption?: string | null;
    platform?: string | null;
    dueAt?: Date | null;
    assets: AssetInput[];
  },
) {
  const [p] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, input.projectId), eq(project.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!p) throw new Error("Project not found");
  if (!ctx.isAdmin && !(await isProjectMember(p.id, ctx.user.id)))
    throw new Error("Only people assigned to this project can request approvals.");
  const assets = validAssets(ctx, input.assets);
  if (assets.length === 0) throw new Error("Add at least one image.");

  const [req] = await db
    .insert(approvalRequest)
    .values({
      workspaceId: ctx.workspace.id,
      projectId: p.id,
      clientId: p.clientId,
      title: input.title,
      brief: input.brief || null,
      caption: input.caption || null,
      platform: (input.platform || null) as RequestRow["platform"],
      dueAt: input.dueAt ?? null,
      shareToken: randomToken(18),
      createdBy: ctx.user.id,
    })
    .returning();
  const [v] = await db
    .insert(version)
    .values({ requestId: req!.id, number: 1, caption: input.caption || null, createdBy: ctx.user.id })
    .returning();
  await db.insert(asset).values(
    assets.map((a, i) => ({
      requestId: req!.id,
      versionId: v!.id,
      storageKey: a.key,
      thumbKey: a.thumbKey ?? null,
      fileName: a.name,
      mimeType: a.mimeType,
      size: a.size,
      width: a.width ?? null,
      height: a.height ?? null,
      position: i,
    })),
  );
  await logActivity({
    workspaceId: ctx.workspace.id,
    requestId: req!.id,
    projectId: p.id,
    clientId: p.clientId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: "request.created",
    meta: { title: req!.title },
  });
  return req!;
}

export async function addVersion(
  ctx: WorkspaceContext,
  requestId: string,
  input: { note?: string | null; caption?: string | null; assets: AssetInput[] },
) {
  const loaded = await loadRequest(ctx, requestId);
  if (!loaded) throw new Error("Not found");
  const { request: req, project: p } = loaded;
  if (!ctx.isAdmin && !(await isProjectMember(p.id, ctx.user.id))) throw new Error("Not allowed");
  if (req.status === "cancelled") throw new Error("This request is cancelled. Reopen it first.");
  const assets = validAssets(ctx, input.assets);
  if (assets.length === 0) throw new Error("Add at least one image.");
  const prev = await latestVersion(req.id);
  const number = (prev?.number ?? 0) + 1;
  const caption = input.caption === undefined ? (prev?.caption ?? req.caption) : input.caption || null;
  const [v] = await db
    .insert(version)
    .values({ requestId: req.id, number, note: input.note || null, caption, createdBy: ctx.user.id })
    .returning();
  await db.insert(asset).values(
    assets.map((a, i) => ({
      requestId: req.id,
      versionId: v!.id,
      storageKey: a.key,
      thumbKey: a.thumbKey ?? null,
      fileName: a.name,
      mimeType: a.mimeType,
      size: a.size,
      width: a.width ?? null,
      height: a.height ?? null,
      position: i,
    })),
  );
  // A draft stays a draft. Anything already in the pipeline goes back through review.
  const nextStatus: ApprovalStatus =
    req.status === "draft" ? "draft" : p.requireInternalApproval ? "internal_review" : "ready";
  await setStatus(req.id, nextStatus, { currentVersion: number, caption, approvedAt: null });
  await logActivity({
    workspaceId: ctx.workspace.id,
    requestId: req.id,
    projectId: p.id,
    clientId: p.clientId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: "version.created",
    meta: { number, note: input.note ?? null },
  });
  if (nextStatus === "internal_review") await notifyInternalReviewers(ctx, req, p.id, number);
  return v!;
}

async function notifyInternalReviewers(ctx: WorkspaceContext, req: RequestRow, projectId: string, number: number) {
  const ids = [...(await workspaceAdminIds(ctx.workspace.id)), ...(await projectMemberIds(projectId))].filter(
    (id) => id !== ctx.user.id,
  );
  await notifyUsers({
    workspaceId: ctx.workspace.id,
    userIds: ids,
    type: "internal_review",
    title: `Internal review needed: ${req.title} (v${number})`,
    body: `${ctx.user.name} submitted this for internal approval before it goes to the client.`,
    link: requestLink(ctx.workspace.slug, req.id),
    email: true,
    brand: { name: ctx.workspace.name, color: ctx.workspace.brandColor },
  });
}

export async function submitForInternalReview(ctx: WorkspaceContext, requestId: string) {
  const loaded = await loadRequest(ctx, requestId);
  if (!loaded) throw new Error("Not found");
  const { request: req, project: p } = loaded;
  if (!(await teamPermissions(ctx, req)).canWork) throw new Error("Not allowed");
  if (!["draft", "internal_changes"].includes(req.status)) throw new Error("Can't submit from this state.");
  if (!p.requireInternalApproval) {
    await setStatus(req.id, "ready");
    return;
  }
  await setStatus(req.id, "internal_review");
  await logActivity({
    workspaceId: ctx.workspace.id,
    requestId: req.id,
    projectId: p.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: "internal.submitted",
    meta: { version: req.currentVersion },
  });
  await notifyInternalReviewers(ctx, req, p.id, req.currentVersion);
}

export async function internalDecision(
  ctx: WorkspaceContext,
  requestId: string,
  outcome: "approved" | "changes_requested",
  note?: string | null,
) {
  const loaded = await loadRequest(ctx, requestId);
  if (!loaded) throw new Error("Not found");
  const { request: req, project: p } = loaded;
  const perms = await teamPermissions(ctx, req);
  if (!perms.canInternalApprove) throw new Error("You can't internally review this version.");
  const v = await latestVersion(req.id);
  if (!v) throw new Error("No version");
  await db.insert(decision).values({
    requestId: req.id,
    versionId: v.id,
    kind: "internal",
    outcome,
    note: note || null,
    userId: ctx.user.id,
    actorName: ctx.user.name,
    actorEmail: ctx.user.email,
    identityVerified: true,
  });
  if (outcome === "approved") {
    await db.update(version).set({ internalApprovedBy: ctx.user.id, internalApprovedAt: new Date() }).where(eq(version.id, v.id));
    await setStatus(req.id, "ready");
  } else {
    await setStatus(req.id, "internal_changes");
  }
  await logActivity({
    workspaceId: ctx.workspace.id,
    requestId: req.id,
    projectId: p.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: outcome === "approved" ? "internal.approved" : "internal.changes_requested",
    meta: { version: v.number, note: note ?? null },
  });
  await notifyUsers({
    workspaceId: ctx.workspace.id,
    userIds: [req.createdBy, v.createdBy].filter((x): x is string => !!x && x !== ctx.user.id),
    type: "internal_decision",
    title:
      outcome === "approved"
        ? `Ready to send: ${req.title} (v${v.number}) was approved internally`
        : `Internal changes requested on ${req.title} (v${v.number})`,
    body: note ? `${ctx.user.name}: “${note}”` : `By ${ctx.user.name}`,
    link: requestLink(ctx.workspace.slug, req.id),
    email: true,
    brand: { name: ctx.workspace.name, color: ctx.workspace.brandColor },
  });
}

/**
 * Sends (or re-sends) the latest version to the client. Creates personal links for the
 * chosen contacts, emails those with an address, and returns the links for WhatsApp sharing.
 */
export async function sendToClient(
  ctx: WorkspaceContext,
  requestId: string,
  input: { contactIds: string[]; message?: string | null; sendEmail: boolean },
) {
  const loaded = await loadRequest(ctx, requestId);
  if (!loaded) throw new Error("Not found");
  const { request: req, project: p, client: c } = loaded;
  if (!(await teamPermissions(ctx, req)).canWork) throw new Error("Only project members can send approvals.");
  const allowed: ApprovalStatus[] = p.requireInternalApproval
    ? ["ready", "in_review", "changes_requested"]
    : ["draft", "ready", "in_review", "changes_requested", "internal_changes", "internal_review"];
  if (!allowed.includes(req.status)) {
    throw new Error(
      req.status === "approved"
        ? "Already approved. Upload a new version to start another round."
        : "This version needs internal approval before it can go to the client.",
    );
  }
  if (req.status === "changes_requested") {
    const v = await latestVersion(req.id);
    if (v?.sentAt) throw new Error("Upload a new version with the requested changes first.");
  }

  const contacts = input.contactIds.length
    ? await db
        .select()
        .from(clientContact)
        .where(and(eq(clientContact.clientId, c.id), inArray(clientContact.id, input.contactIds)))
    : [];

  const now = new Date();
  const links: { contactId: string; name: string; phone: string | null; email: string | null; url: string }[] = [];
  for (const contact of contacts) {
    const [existing] = await db
      .select()
      .from(approvalRecipient)
      .where(and(eq(approvalRecipient.requestId, req.id), eq(approvalRecipient.contactId, contact.id)))
      .limit(1);
    const rec =
      existing ??
      (
        await db
          .insert(approvalRecipient)
          .values({ requestId: req.id, contactId: contact.id, accessKey: randomToken(12) })
          .returning()
      )[0]!;
    await db.update(approvalRecipient).set({ lastSentAt: now }).where(eq(approvalRecipient.id, rec.id));
    links.push({
      contactId: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      url: reviewUrl(req.shareToken, rec.accessKey),
    });
  }

  const v = await latestVersion(req.id);
  if (v && !v.sentAt) await db.update(version).set({ sentAt: now }).where(eq(version.id, v.id));
  const wasInReview = req.status === "in_review";
  await setStatus(req.id, "in_review", { sentAt: req.sentAt ?? now, linkEnabled: true });

  if (input.sendEmail) {
    for (const l of links) {
      if (!l.email) continue;
      const { html, text } = emailLayout({
        brand: ctx.workspace.name,
        color: ctx.workspace.brandColor,
        heading: `${wasInReview ? "Reminder: " : ""}Please review “${req.title}”`,
        lines: [
          `Hi ${l.name.split(" ")[0]},`,
          `${ctx.workspace.name} has shared ${v ? `version ${v.number} of ` : ""}“${req.title}” for your approval.`,
          ...(input.message ? [input.message] : []),
          ...(req.dueAt ? [`Please review by ${req.dueAt.toDateString()}.`] : []),
          "You can leave comments directly on the design and approve or request changes. No login needed.",
        ],
        cta: { label: "Review now", url: l.url },
        footer: `Sent by ${ctx.user.name} at ${ctx.workspace.name} via Approval OS`,
      });
      await sendEmail({
        to: l.email,
        subject: `${wasInReview ? "Reminder: " : ""}Approval needed: ${req.title}`,
        html,
        text,
        replyTo: ctx.user.email,
      });
    }
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    requestId: req.id,
    projectId: p.id,
    clientId: c.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: wasInReview ? "client.resent" : "client.sent",
    meta: { version: v?.number, to: links.map((l) => l.name) },
  });
  if (!wasInReview) {
    await postProjectSystemMessage(
      p.id,
      `📤 ${ctx.user.name} sent **${req.title}** (v${v?.number ?? 1}) to ${c.name} for approval.`,
      req.id,
    );
  }
  return { links, publicUrl: reviewUrl(req.shareToken) };
}

export async function cancelRequest(ctx: WorkspaceContext, requestId: string) {
  const loaded = await loadRequest(ctx, requestId);
  if (!loaded) throw new Error("Not found");
  const perms = await teamPermissions(ctx, loaded.request);
  if (!perms.canCancel) throw new Error("Only the creator or an admin can cancel.");
  await setStatus(requestId, "cancelled");
  await logActivity({
    workspaceId: ctx.workspace.id,
    requestId,
    projectId: loaded.project.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: "request.cancelled",
  });
}

export async function reopenRequest(ctx: WorkspaceContext, requestId: string) {
  const loaded = await loadRequest(ctx, requestId);
  if (!loaded) throw new Error("Not found");
  const perms = await teamPermissions(ctx, loaded.request);
  if (!perms.canCancel) throw new Error("Only the creator or an admin can reopen.");
  await setStatus(requestId, "draft");
  await logActivity({
    workspaceId: ctx.workspace.id,
    requestId,
    projectId: loaded.project.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: "request.reopened",
  });
}

/* -------------------------------------------------------------------------- */
/*                               Client decisions                              */
/* -------------------------------------------------------------------------- */

export async function clientDecision(input: {
  request: RequestRow;
  reviewer: typeof reviewer.$inferSelect;
  versionId: string;
  outcome: "approved" | "changes_requested";
  note?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const { request: req, reviewer: rv } = input;
  if (req.status !== "in_review") throw new Error("This request isn't open for review right now.");
  const v = await latestVersion(req.id);
  if (!v || v.id !== input.versionId || !v.sentAt) throw new Error("Please review the latest version.");
  if (!(await reviewerCanApprove(rv, req))) throw new Error("Only designated approvers can make the final decision.");

  await db.insert(decision).values({
    requestId: req.id,
    versionId: v.id,
    kind: "client",
    outcome: input.outcome,
    note: input.note || null,
    reviewerId: rv.id,
    actorName: rv.name,
    actorEmail: rv.email,
    identityVerified: rv.verified,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
  const now = new Date();
  await setStatus(req.id, input.outcome === "approved" ? "approved" : "changes_requested", {
    approvedAt: input.outcome === "approved" ? now : null,
  });
  if (input.note) {
    await db.insert(comment).values({
      workspaceId: req.workspaceId,
      requestId: req.id,
      versionId: v.id,
      authorReviewerId: rv.id,
      body: input.outcome === "approved" ? `✅ Approved: ${input.note}` : `✏️ Changes requested: ${input.note}`,
    });
  }
  await logActivity({
    workspaceId: req.workspaceId,
    requestId: req.id,
    projectId: req.projectId,
    clientId: req.clientId,
    actorReviewerId: rv.id,
    actorName: rv.name,
    action: input.outcome === "approved" ? "client.approved" : "client.changes_requested",
    meta: { version: v.number, note: input.note ?? null, verified: rv.verified },
    ip: input.ip ?? null,
  });

  const [ws] = await db.select().from(workspace).where(eq(workspace.id, req.workspaceId)).limit(1);
  const ids = [...(await projectMemberIds(req.projectId)), req.createdBy].filter((x): x is string => !!x);
  const approved = input.outcome === "approved";
  await notifyUsers({
    workspaceId: req.workspaceId,
    userIds: ids,
    type: approved ? "client_approved" : "client_changes",
    title: approved
      ? `✅ ${rv.name} approved “${req.title}” (v${v.number})`
      : `✏️ ${rv.name} requested changes on “${req.title}” (v${v.number})`,
    body: input.note ?? null,
    link: requestLink(ws!.slug, req.id),
    email: true,
    brand: { name: ws!.name, color: ws!.brandColor },
  });
  await postProjectSystemMessage(
    req.projectId,
    approved
      ? `✅ **${rv.name}** approved **${req.title}** (v${v.number}).${input.note ? ` “${input.note}”` : ""}`
      : `✏️ **${rv.name}** requested changes on **${req.title}** (v${v.number}).${input.note ? ` “${input.note}”` : ""}`,
    req.id,
  );
  if (approved) {
    await db.insert(decisionLog).values({
      workspaceId: req.workspaceId,
      projectId: req.projectId,
      title: `Client approved “${req.title}” (v${v.number})`,
      details: input.note || null,
      status: "decided",
      source: "approval",
      requestId: req.id,
      decidedBy: `${rv.name}${rv.email ? ` <${rv.email}>` : ""}`,
      decidedAt: now,
    });
  }
}

export async function reviewerCanApprove(rv: typeof reviewer.$inferSelect, req: RequestRow) {
  if (!rv.contactId) return false;
  const [contact] = await db
    .select()
    .from(clientContact)
    .where(and(eq(clientContact.id, rv.contactId), eq(clientContact.clientId, req.clientId)))
    .limit(1);
  return !!contact?.isApprover;
}

/* -------------------------------------------------------------------------- */
/*                               Review payload                                */
/* -------------------------------------------------------------------------- */

export type ReviewPayload = Awaited<ReturnType<typeof buildReviewPayload>>;

export async function buildReviewPayload(
  req: RequestRow,
  viewer:
    | { kind: "team"; userId: string; ctx: WorkspaceContext }
    | { kind: "client"; reviewer: typeof reviewer.$inferSelect | null },
) {
  const isTeam = viewer.kind === "team";
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, req.workspaceId)).limit(1);
  const [c] = await db.select().from(client).where(eq(client.id, req.clientId)).limit(1);
  const [p] = await db.select().from(project).where(eq(project.id, req.projectId)).limit(1);

  const versionRows = await db
    .select()
    .from(version)
    .where(isTeam ? eq(version.requestId, req.id) : and(eq(version.requestId, req.id), isNotNull(version.sentAt)))
    .orderBy(asc(version.number));
  const versionIds = versionRows.map((v) => v.id);
  const assetRows = versionIds.length
    ? await db.select().from(asset).where(inArray(asset.versionId, versionIds)).orderBy(asc(asset.position))
    : [];

  const commentRows = versionIds.length
    ? await db
        .select({
          comment,
          userName: user.name,
          userImage: user.image,
          reviewerName: reviewer.name,
        })
        .from(comment)
        .leftJoin(user, eq(user.id, comment.authorUserId))
        .leftJoin(reviewer, eq(reviewer.id, comment.authorReviewerId))
        .where(
          and(
            eq(comment.requestId, req.id),
            inArray(comment.versionId, versionIds),
            isNull(comment.deletedAt),
            isTeam ? undefined : eq(comment.visibility, "shared"),
          ),
        )
        .orderBy(asc(comment.createdAt))
    : [];

  // Designations for team authors, so clients see "Priya · Account Manager".
  const authorIds = [...new Set(commentRows.map((r) => r.comment.authorUserId).filter(Boolean))] as string[];
  const designations = authorIds.length
    ? await db
        .select({ userId: membership.userId, designation: membership.designation })
        .from(membership)
        .where(and(eq(membership.workspaceId, req.workspaceId), inArray(membership.userId, authorIds)))
    : [];
  const designationOf = new Map(designations.map((d) => [d.userId, d.designation]));

  const decisionRows = await db
    .select()
    .from(decision)
    .where(
      and(eq(decision.requestId, req.id), isTeam ? undefined : eq(decision.kind, "client")),
    )
    .orderBy(desc(decision.createdAt));

  let viewerInfo: {
    kind: "team" | "client";
    id: string | null;
    name: string | null;
    email?: string | null;
    verified?: boolean;
    canComment: boolean;
    canApprove: boolean;
    canInternalApprove: boolean;
    canWork: boolean;
    canCancel: boolean;
  };
  if (viewer.kind === "team") {
    const perms = await teamPermissions(viewer.ctx, req);
    viewerInfo = {
      kind: "team",
      id: viewer.userId,
      name: viewer.ctx.user.name,
      canComment: true,
      canApprove: false,
      ...perms,
    };
  } else {
    const rv = viewer.reviewer;
    viewerInfo = {
      kind: "client",
      id: rv?.id ?? null,
      name: rv?.name ?? null,
      email: rv?.email ?? null,
      verified: rv?.verified ?? false,
      canComment: !!rv && req.status !== "cancelled",
      canApprove: !!rv && req.status === "in_review" && (await reviewerCanApprove(rv, req)),
      canInternalApprove: false,
      canWork: false,
      canCancel: false,
    };
  }

  const recipients = isTeam
    ? await db
        .select({
          id: approvalRecipient.id,
          contactId: clientContact.id,
          name: clientContact.name,
          email: clientContact.email,
          phone: clientContact.phone,
          isApprover: clientContact.isApprover,
          accessKey: approvalRecipient.accessKey,
          lastSentAt: approvalRecipient.lastSentAt,
        })
        .from(approvalRecipient)
        .innerJoin(clientContact, eq(clientContact.id, approvalRecipient.contactId))
        .where(eq(approvalRecipient.requestId, req.id))
    : [];

  const activityRows = isTeam
    ? await db
        .select()
        .from(activity)
        .where(eq(activity.requestId, req.id))
        .orderBy(desc(activity.createdAt))
        .limit(60)
    : [];
  const contactRows = isTeam
    ? await db.select().from(clientContact).where(eq(clientContact.clientId, req.clientId)).orderBy(asc(clientContact.name))
    : [];

  return {
    activity: activityRows.map((a) => ({
      id: a.id,
      action: a.action,
      actorName: a.actorName,
      meta: a.meta,
      createdAt: a.createdAt.toISOString(),
    })),
    contacts: contactRows.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      designation: c.designation,
      isApprover: c.isApprover,
    })),
    workspace: {
      name: ws!.name,
      slug: isTeam ? ws!.slug : null,
      logoUrl: fileUrl(ws!.logoKey),
      brandColor: ws!.brandColor,
    },
    client: { id: c!.id, name: c!.name, logoUrl: fileUrl(c!.logoKey) },
    project: { id: p!.id, name: p!.name, requireInternalApproval: p!.requireInternalApproval },
    request: {
      id: req.id,
      title: req.title,
      brief: req.brief,
      caption: req.caption,
      platform: req.platform,
      status: req.status,
      statusLabel: isTeam ? STATUS_META[req.status].label : STATUS_META[req.status].clientLabel,
      dueAt: req.dueAt?.toISOString() ?? null,
      approvedAt: req.approvedAt?.toISOString() ?? null,
      currentVersion: req.currentVersion,
      linkEnabled: req.linkEnabled,
      shareToken: isTeam ? req.shareToken : null,
      publicUrl: isTeam ? reviewUrl(req.shareToken) : null,
    },
    versions: versionRows.map((v) => ({
      id: v.id,
      number: v.number,
      note: v.note,
      caption: v.caption,
      createdAt: v.createdAt.toISOString(),
      sentAt: v.sentAt?.toISOString() ?? null,
      internalApprovedAt: isTeam ? (v.internalApprovedAt?.toISOString() ?? null) : null,
      assets: assetRows
        .filter((a) => a.versionId === v.id)
        .map((a) => ({
          id: a.id,
          url: fileUrl(a.storageKey)!,
          thumbUrl: fileUrl(a.thumbKey ?? a.storageKey)!,
          width: a.width,
          height: a.height,
          fileName: a.fileName,
        })),
    })),
    comments: commentRows.map(({ comment: cm, userName, reviewerName }) => ({
      id: cm.id,
      versionId: cm.versionId,
      assetId: cm.assetId,
      parentId: cm.parentId,
      body: cm.body,
      visibility: cm.visibility,
      annotation: cm.annotation as Annotation | null,
      captionQuote: cm.captionQuote,
      source: cm.source,
      resolvedAt: cm.resolvedAt?.toISOString() ?? null,
      createdAt: cm.createdAt.toISOString(),
      author: cm.authorUserId
        ? {
            kind: "team" as const,
            name: userName ?? "Team member",
            designation: designationOf.get(cm.authorUserId) ?? null,
            agency: ws!.name,
          }
        : { kind: "client" as const, name: reviewerName ?? "Client", designation: null, agency: null },
      mine:
        viewer.kind === "team"
          ? cm.authorUserId === viewer.userId
          : !!viewer.reviewer && cm.authorReviewerId === viewer.reviewer.id,
    })),
    decisions: decisionRows.map((d) => ({
      id: d.id,
      kind: d.kind,
      outcome: d.outcome,
      note: d.note,
      actorName: d.actorName,
      actorEmail: isTeam ? d.actorEmail : null,
      identityVerified: d.identityVerified,
      versionNumber: versionRows.find((v) => v.id === d.versionId)?.number ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    recipients: recipients.map((r) => ({
      ...r,
      url: reviewUrl(req.shareToken, r.accessKey),
      lastSentAt: r.lastSentAt?.toISOString() ?? null,
    })),
    viewer: viewerInfo,
  };
}
