import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { invitation } from "@/db/schema";
import { env } from "@/lib/env";
import { workspaceMembers } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { InviteButton, MembersTable, PendingInvites } from "./team-client";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const members = await workspaceMembers(ctx.workspace.id);
  const invites = ctx.isAdmin
    ? await db
        .select()
        .from(invitation)
        .where(
          and(
            eq(invitation.workspaceId, ctx.workspace.id),
            isNull(invitation.acceptedAt),
            isNull(invitation.revokedAt),
            gt(invitation.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(invitation.createdAt))
    : [];
  return (
    <>
      <PageHeader
        title="Team"
        description={`${members.length} ${members.length === 1 ? "person" : "people"} in ${ctx.workspace.name}. Designations are shown to clients next to comments.`}
        actions={ctx.isAdmin ? <InviteButton slug={slug} workspaceName={ctx.workspace.name} /> : null}
      />
      <MembersTable
        slug={slug}
        meId={ctx.user.id}
        myRole={ctx.role}
        members={members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))}
      />
      {invites.length ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Pending invites</h2>
          <PendingInvites
            slug={slug}
            workspaceName={ctx.workspace.name}
            invites={invites.map((i) => ({
              id: i.id,
              email: i.email,
              role: i.role,
              designation: i.designation,
              url: `${env.appUrl}/invite/${i.token}`,
              expiresAt: i.expiresAt.toISOString(),
            }))}
          />
        </div>
      ) : null}
    </>
  );
}
