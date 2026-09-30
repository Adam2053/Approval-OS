"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { channel, channelMember, invitation, membership, workspace } from "@/db/schema";
import { logActivity } from "@/lib/events";
import { requireUser } from "@/lib/session";

export async function acceptInvite(token: string) {
  const user = await requireUser(`/invite/${token}`);
  const [inv] = await db
    .select({ invitation, workspace })
    .from(invitation)
    .innerJoin(workspace, eq(workspace.id, invitation.workspaceId))
    .where(
      and(
        eq(invitation.token, token),
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!inv) redirect(`/invite/${token}`);
  await db
    .insert(membership)
    .values({
      workspaceId: inv.workspace.id,
      userId: user.id,
      role: inv.invitation.role,
      designation: inv.invitation.designation,
    })
    .onConflictDoNothing();
  await db.update(invitation).set({ acceptedAt: new Date() }).where(eq(invitation.id, inv.invitation.id));
  const defaults = await db
    .select({ id: channel.id })
    .from(channel)
    .where(and(eq(channel.workspaceId, inv.workspace.id), eq(channel.isDefault, true)));
  if (defaults.length)
    await db
      .insert(channelMember)
      .values(defaults.map((c) => ({ channelId: c.id, userId: user.id })))
      .onConflictDoNothing();
  await logActivity({
    workspaceId: inv.workspace.id,
    actorUserId: user.id,
    actorName: user.name,
    action: "member.joined",
    meta: { role: inv.invitation.role },
  });
  redirect(`/w/${inv.workspace.slug}`);
}
