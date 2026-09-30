import { and, desc, eq } from "drizzle-orm";
import { FileCheck2, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelView } from "@/components/chat/channel-view";
import { RequestList } from "@/components/request-list";
import { Avatar, Card, EmptyState, LinkButton, PageHeader, Tabs } from "@/components/ui";
import { db } from "@/db";
import { approvalRequest, client, decisionLog, project, projectMember, user } from "@/db/schema";
import { ensureProjectChannel } from "@/lib/events";
import { requestsList, workspaceMembers } from "@/lib/queries";
import { canWorkOnProject, requireWorkspace } from "@/lib/session";
import { fileUrl, formatDate } from "@/lib/utils";
import { DecisionLog, InternalApprovalToggle, ProjectMembers, ProjectSettingsForm } from "../forms";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug, projectId } = await params;
  const { tab = "approvals" } = await searchParams;
  const ctx = await requireWorkspace(slug);
  const [row] = await db
    .select({ project, client })
    .from(project)
    .innerJoin(client, eq(client.id, project.clientId))
    .where(and(eq(project.id, projectId), eq(project.workspaceId, ctx.workspace.id)));
  if (!row) notFound();
  const p = row.project;
  const canWork = await canWorkOnProject(ctx, p.id);
  const allMembers = await workspaceMembers(ctx.workspace.id);
  const memberRows = await db
    .select({ userId: user.id })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .where(eq(projectMember.projectId, p.id));
  const memberIds = new Set(memberRows.map((m) => m.userId));
  const members = allMembers.filter((m) => memberIds.has(m.userId));
  const base = `/w/${slug}/projects/${p.id}`;
  const toMember = (m: (typeof allMembers)[number]) => ({ userId: m.userId, name: m.name, image: m.image, designation: m.designation });

  return (
    <>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-1.5">
            <Link href={`/w/${slug}/clients/${row.client.id}`} className="flex items-center gap-1.5 hover:text-zinc-800">
              <Avatar name={row.client.name} src={fileUrl(row.client.logoKey)} size={18} square /> {row.client.name}
            </Link>
            <span>/</span>
            <Link href={`/w/${slug}/projects`} className="hover:text-zinc-800">
              Projects
            </Link>
          </span>
        }
        title={p.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="capitalize">{p.status.replace("_", " ")}</span>
            {p.dueDate ? <span>Due {formatDate(p.dueDate)}</span> : null}
            <span className="flex -space-x-1.5">
              {members.slice(0, 6).map((m) => (
                <Avatar key={m.userId} name={m.name} src={m.image} size={22} className="ring-2 ring-zinc-50" />
              ))}
            </span>
          </span>
        }
        actions={
          canWork ? (
            <LinkButton href={`${base}/approvals/new`}>
              <Plus className="h-4 w-4" /> New approval
            </LinkButton>
          ) : null
        }
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "approvals", label: "Approvals", href: base },
          { key: "discussion", label: "Discussion", href: `${base}?tab=discussion` },
          { key: "decisions", label: "Decision log", href: `${base}?tab=decisions` },
          { key: "members", label: "Team", href: `${base}?tab=members`, count: members.length },
          { key: "settings", label: "Settings", href: `${base}?tab=settings` },
        ]}
      />

      {tab === "approvals" ? (
        <div className="space-y-4">
          <InternalApprovalToggle slug={slug} projectId={p.id} value={p.requireInternalApproval} canEdit={canWork} />
          <RequestList
            slug={slug}
            showProject={false}
            items={await requestsList(ctx.workspace.id, { projectId: p.id })}
            empty={
              <EmptyState
                icon={<FileCheck2 className="h-5 w-5" />}
                title="No approvals yet"
                description={
                  canWork
                    ? "Upload a creative, add the caption and send it to the client."
                    : "Only people assigned to this project can request approvals."
                }
                action={canWork ? <LinkButton href={`${base}/approvals/new`}>Create approval</LinkButton> : null}
              />
            }
          />
        </div>
      ) : null}

      {tab === "discussion" ? (
        <Card className="h-[calc(100dvh-16rem)] min-h-[28rem] overflow-hidden">
          <ChannelView
            slug={slug}
            channelId={(await ensureProjectChannel(p.id)).id}
            me={{ id: ctx.user.id, name: ctx.user.name }}
            members={allMembers.map((m) => ({ id: m.userId, name: m.name, image: m.image, designation: m.designation }))}
            embedded
          />
        </Card>
      ) : null}

      {tab === "decisions" ? (
        <DecisionLog
          slug={slug}
          projectId={p.id}
          decisions={(
            await db
              .select({ d: decisionLog, requestTitle: approvalRequest.title })
              .from(decisionLog)
              .leftJoin(approvalRequest, eq(approvalRequest.id, decisionLog.requestId))
              .where(eq(decisionLog.projectId, p.id))
              .orderBy(desc(decisionLog.decidedAt))
          ).map(({ d, requestTitle }) => ({
            id: d.id,
            title: d.title,
            details: d.details,
            status: d.status,
            source: d.source,
            decidedBy: d.decidedBy,
            decidedAt: d.decidedAt.toISOString(),
            requestId: d.requestId,
            requestTitle,
          }))}
        />
      ) : null}

      {tab === "members" ? (
        <ProjectMembers slug={slug} projectId={p.id} members={members.map(toMember)} allMembers={allMembers.map(toMember)} canEdit={canWork} />
      ) : null}

      {tab === "settings" ? (
        <Card className="p-5">
          {canWork ? (
            <ProjectSettingsForm
              slug={slug}
              isAdmin={ctx.isAdmin}
              project={{
                id: p.id,
                name: p.name,
                description: p.description,
                status: p.status,
                startDate: p.startDate?.toISOString() ?? null,
                dueDate: p.dueDate?.toISOString() ?? null,
                requireInternalApproval: p.requireInternalApproval,
              }}
            />
          ) : (
            <p className="text-sm text-zinc-500">Only project members and admins can change project settings.</p>
          )}
        </Card>
      ) : null}
    </>
  );
}
