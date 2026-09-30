import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { approvalRecipient, approvalRequest, clientContact, reviewer } from "@/db/schema";
import { logActivity } from "./events";
import { randomToken } from "./utils";

type Reviewer = typeof reviewer.$inferSelect;
type Req = typeof approvalRequest.$inferSelect;

const cookieName = (clientId: string) => `aos_rv_${clientId.replace(/-/g, "").slice(0, 16)}`;

export async function requestByToken(token: string) {
  const [req] = await db.select().from(approvalRequest).where(eq(approvalRequest.shareToken, token)).limit(1);
  if (!req || !req.linkEnabled) return null;
  return req;
}

export async function currentReviewer(req: Req): Promise<Reviewer | null> {
  const secret = (await cookies()).get(cookieName(req.clientId))?.value;
  if (!secret) return null;
  const [rv] = await db
    .select()
    .from(reviewer)
    .where(and(eq(reviewer.secret, secret), eq(reviewer.clientId, req.clientId)))
    .limit(1);
  return rv ?? null;
}

async function setCookie(req: Req, rv: Reviewer) {
  (await cookies()).set(cookieName(req.clientId), rv.secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Personal link (?k=…): identity is verified because only that contact received the key. */
export async function identifyWithKey(req: Req, accessKey: string) {
  const [row] = await db
    .select({ contact: clientContact })
    .from(approvalRecipient)
    .innerJoin(clientContact, eq(clientContact.id, approvalRecipient.contactId))
    .where(and(eq(approvalRecipient.accessKey, accessKey), eq(approvalRecipient.requestId, req.id)))
    .limit(1);
  if (!row) return null;
  const c = row.contact;
  let [rv] = await db
    .select()
    .from(reviewer)
    .where(and(eq(reviewer.clientId, req.clientId), eq(reviewer.contactId, c.id), eq(reviewer.verified, true)))
    .limit(1);
  if (!rv) {
    [rv] = await db
      .insert(reviewer)
      .values({
        workspaceId: req.workspaceId,
        clientId: req.clientId,
        contactId: c.id,
        name: c.name,
        email: c.email,
        secret: randomToken(24),
        verified: true,
      })
      .returning();
  }
  await setCookie(req, rv!);
  await logActivity({
    workspaceId: req.workspaceId,
    requestId: req.id,
    projectId: req.projectId,
    clientId: req.clientId,
    actorReviewerId: rv!.id,
    actorName: rv!.name,
    action: "client.opened",
    meta: { via: "personal link" },
  });
  return rv!;
}

/**
 * Shared/group link: the reviewer tells us who they are. If the email matches a client contact
 * we link them to it (so approvers can approve), but mark the identity as self-declared.
 */
export async function identifyWithDetails(req: Req, name: string, email: string | null) {
  const cleanEmail = email?.trim().toLowerCase() || null;
  const [contact] = cleanEmail
    ? await db
        .select()
        .from(clientContact)
        .where(and(eq(clientContact.clientId, req.clientId), sql`lower(${clientContact.email}) = ${cleanEmail}`))
        .limit(1)
    : [];
  let [rv] = cleanEmail
    ? await db
        .select()
        .from(reviewer)
        .where(and(eq(reviewer.clientId, req.clientId), sql`lower(${reviewer.email}) = ${cleanEmail}`, eq(reviewer.verified, false)))
        .limit(1)
    : [];
  if (rv) {
    [rv] = await db
      .update(reviewer)
      .set({ name, contactId: contact?.id ?? null })
      .where(eq(reviewer.id, rv.id))
      .returning();
  } else {
    [rv] = await db
      .insert(reviewer)
      .values({
        workspaceId: req.workspaceId,
        clientId: req.clientId,
        contactId: contact?.id ?? null,
        name,
        email: cleanEmail,
        secret: randomToken(24),
        verified: false,
      })
      .returning();
  }
  await setCookie(req, rv!);
  await logActivity({
    workspaceId: req.workspaceId,
    requestId: req.id,
    projectId: req.projectId,
    clientId: req.clientId,
    actorReviewerId: rv!.id,
    actorName: rv!.name,
    action: "client.opened",
    meta: { via: "shared link" },
  });
  return rv!;
}

export async function touchReviewer(req: Req, rv: Reviewer) {
  const stale = !rv.lastSeenAt || Date.now() - rv.lastSeenAt.getTime() > 30 * 60 * 1000;
  if (!stale) return;
  await db.update(reviewer).set({ lastSeenAt: new Date() }).where(eq(reviewer.id, rv.id));
  await logActivity({
    workspaceId: req.workspaceId,
    requestId: req.id,
    projectId: req.projectId,
    clientId: req.clientId,
    actorReviewerId: rv.id,
    actorName: rv.name,
    action: "client.viewed",
    meta: { version: req.currentVersion },
  });
}
