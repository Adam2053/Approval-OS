import { and, count, desc, eq, gte, inArray, lt, notInArray } from "drizzle-orm";
import { ArrowRight, Building2, CheckCircle2, Circle, FileCheck2, History, Users } from "lucide-react";
import Link from "next/link";
import { RequestList } from "@/components/request-list";
import { Card, CardHeader, LinkButton, PageHeader, Stat } from "@/components/ui";
import { db } from "@/db";
import { activity, approvalRequest, client, clientContact, invitation, membership, project, projectMember } from "@/db/schema";
import { requestsList } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { nowMs, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

async function countWhere(workspaceId: string, extra: Parameters<typeof and>[number]) {
  const [row] = await db.select({ n: count() }).from(approvalRequest).where(and(eq(approvalRequest.workspaceId, workspaceId), extra));
  return row?.n ?? 0;
}

const ACTIVITY_TEXT: Record<string, string> = {
  "request.created": "created an approval",
  "version.created": "uploaded a new version",
  "internal.submitted": "submitted for internal approval",
  "internal.approved": "approved internally",
  "internal.changes_requested": "requested internal changes",
  "client.sent": "sent an approval to the client",
  "client.resent": "reminded the client",
  "client.opened": "opened a review link",
  "client.viewed": "viewed a review",
  "client.commented": "commented on a review",
  "client.approved": "approved",
  "client.changes_requested": "requested changes",
  "client.created": "added a client",
  "project.created": "created a project",
  "member.joined": "joined the workspace",
  "reminder.sent": "sent a reminder",
};

export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const ws = ctx.workspace.id;
  const weekAgo = new Date(nowMs() - 7 * 24 * 60 * 60 * 1000);

  const myProjectIds = (
    await db.select({ id: projectMember.projectId }).from(projectMember).where(eq(projectMember.userId, ctx.user.id))
  ).map((r) => r.id);
  const scope = ctx.isAdmin ? undefined : myProjectIds.length ? inArray(approvalRequest.projectId, myProjectIds) : eq(approvalRequest.id, "__none__");

  const [waiting, internal, changes, approvedWeek, overdue] = await Promise.all([
    countWhere(ws, eq(approvalRequest.status, "in_review")),
    countWhere(ws, eq(approvalRequest.status, "internal_review")),
    countWhere(ws, inArray(approvalRequest.status, ["changes_requested", "internal_changes"])),
    countWhere(ws, and(eq(approvalRequest.status, "approved"), gte(approvalRequest.approvedAt, weekAgo))),
    countWhere(ws, and(lt(approvalRequest.dueAt, new Date()), notInArray(approvalRequest.status, ["approved", "cancelled"]))),
  ]);

  const attention = (
    await requestsList(ws, { statuses: ["internal_review", "internal_changes", "changes_requested", "ready"], limit: 50 })
  ).filter((r) => ctx.isAdmin || myProjectIds.includes(r.projectId));
  const onClient = (await requestsList(ws, { statuses: ["in_review"], limit: 8 })).filter(
    (r) => ctx.isAdmin || myProjectIds.includes(r.projectId),
  );

  const recent = await db.select().from(activity).where(eq(activity.workspaceId, ws)).orderBy(desc(activity.createdAt)).limit(12);

  // Getting-started checklist for new workspaces.
  const [[clients], [contacts], [projects], [members], [invites], [requests]] = await Promise.all([
    db.select({ n: count() }).from(client).where(eq(client.workspaceId, ws)),
    db.select({ n: count() }).from(clientContact).where(eq(clientContact.workspaceId, ws)),
    db.select({ n: count() }).from(project).where(eq(project.workspaceId, ws)),
    db.select({ n: count() }).from(membership).where(eq(membership.workspaceId, ws)),
    db.select({ n: count() }).from(invitation).where(eq(invitation.workspaceId, ws)),
    db.select({ n: count() }).from(approvalRequest).where(and(eq(approvalRequest.workspaceId, ws), scope)),
  ]);
  const steps = [
    { done: clients!.n > 0, label: "Add your first client", href: `/w/${slug}/clients` },
    { done: contacts!.n > 0, label: "Add a client contact (the approver)", href: `/w/${slug}/clients` },
    { done: projects!.n > 0, label: "Create a project", href: `/w/${slug}/projects` },
    { done: members!.n > 1 || invites!.n > 0, label: "Invite your team", href: `/w/${slug}/team` },
    { done: requests!.n > 0, label: "Send your first approval", href: `/w/${slug}/projects` },
  ];
  const showChecklist = steps.some((s) => !s.done);

  return (
    <>
      <PageHeader
        title={`Hi ${ctx.user.name.split(" ")[0]} 👋`}
        description={`Here’s what’s happening at ${ctx.workspace.name}.`}
        actions={
          <>
            <LinkButton href={`/w/${slug}/clients`} variant="secondary">
              <Building2 className="h-4 w-4" /> Clients
            </LinkButton>
            <LinkButton href={`/w/${slug}/projects`}>
              <FileCheck2 className="h-4 w-4" /> New approval
            </LinkButton>
          </>
        }
      />

      {showChecklist ? (
        <Card className="mb-6 overflow-hidden">
          <CardHeader title="Get set up" description="A few steps to your first client approval." />
          <div className="grid gap-px bg-zinc-100 sm:grid-cols-5">
            {steps.map((s, i) => (
              <Link key={i} href={s.href} className="flex items-center gap-2 bg-white p-4 text-sm hover:bg-zinc-50">
                {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-zinc-300" />}
                <span className={s.done ? "text-zinc-400 line-through" : "font-medium"}>{s.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Waiting on client" value={waiting} href={`/w/${slug}/approvals?f=client`} />
        <Stat label="Internal review" value={internal} href={`/w/${slug}/approvals?f=internal`} />
        <Stat label="Changes requested" value={changes} href={`/w/${slug}/approvals?f=changes`} />
        <Stat label="Overdue" value={<span className={overdue ? "text-rose-600" : ""}>{overdue}</span>} href={`/w/${slug}/approvals?f=overdue`} />
        <Stat label="Approved (7 days)" value={<span className="text-emerald-600">{approvedWeek}</span>} href={`/w/${slug}/approvals?f=approved`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700">Needs your team’s attention</h2>
              <Link href={`/w/${slug}/approvals`} className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
                All approvals <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <RequestList
              slug={slug}
              items={attention.slice(0, 8)}
              empty={<p className="p-8 text-center text-sm text-zinc-500">Nothing needs attention right now. 🎉</p>}
            />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">Waiting on clients</h2>
            <RequestList
              slug={slug}
              items={onClient}
              empty={<p className="p-8 text-center text-sm text-zinc-500">No approvals are out with clients.</p>}
            />
          </section>
        </div>
        <aside>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><History className="h-4 w-4 text-zinc-400" /> Recent activity</span>} />
            {recent.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">Activity will show up here.</p>
            ) : (
              <ol className="divide-y divide-zinc-50">
                {recent.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-sm">
                    {a.requestId ? (
                      <Link href={`/w/${slug}/approvals/${a.requestId}`} className="hover:underline">
                        <b className="font-medium">{a.actorName}</b> {ACTIVITY_TEXT[a.action] ?? a.action}
                      </Link>
                    ) : (
                      <span>
                        <b className="font-medium">{a.actorName}</b> {ACTIVITY_TEXT[a.action] ?? a.action}
                      </span>
                    )}
                    <div className="text-xs text-zinc-400">{timeAgo(a.createdAt)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Link href={`/w/${slug}/team`} className="mt-4 flex items-center gap-2 rounded-xl bg-white p-4 text-sm ring-1 ring-zinc-200 hover:bg-zinc-50">
            <Users className="h-4 w-4 text-zinc-400" /> {members!.n} team {members!.n === 1 ? "member" : "members"}
            <ArrowRight className="ml-auto h-4 w-4 text-zinc-300" />
          </Link>
        </aside>
      </div>
    </>
  );
}
