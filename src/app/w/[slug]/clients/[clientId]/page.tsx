import { and, asc, eq } from "drizzle-orm";
import { Briefcase, Globe, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestList } from "@/components/request-list";
import { Avatar, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { db } from "@/db";
import { client, clientContact } from "@/db/schema";
import { projectsList, requestsList, workspaceMembers } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { fileUrl, formatPhone } from "@/lib/utils";
import { ProjectGrid } from "@/components/project-grid";
import { NewProjectButton } from "../../projects/forms";
import { ContactsManager, EditClientForm } from "../forms";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; clientId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug, clientId } = await params;
  const { tab = "projects" } = await searchParams;
  const ctx = await requireWorkspace(slug);
  const [c] = await db
    .select()
    .from(client)
    .where(and(eq(client.id, clientId), eq(client.workspaceId, ctx.workspace.id)));
  if (!c) notFound();
  const contacts = await db.select().from(clientContact).where(eq(clientContact.clientId, c.id)).orderBy(asc(clientContact.createdAt));
  const base = `/w/${slug}/clients/${c.id}`;
  const members = await workspaceMembers(ctx.workspace.id);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`/w/${slug}/clients`} className="hover:text-zinc-800">
            Clients
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name} src={fileUrl(c.logoKey)} size={40} square />
            {c.name}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {c.industry ? <span>{c.industry}</span> : null}
            {c.website ? (
              <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-zinc-800">
                <Globe className="h-3.5 w-3.5" /> {c.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
            {c.email ? (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {c.email}
              </span>
            ) : null}
            {c.phone ? (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {formatPhone(c.phone)}
              </span>
            ) : null}
          </span>
        }
        actions={
          <NewProjectButton
            slug={slug}
            clients={[{ id: c.id, name: c.name }]}
            defaultClientId={c.id}
            meId={ctx.user.id}
            members={members.map((m) => ({ userId: m.userId, name: m.name, image: m.image, designation: m.designation }))}
          />
        }
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "projects", label: "Projects", href: base },
          { key: "approvals", label: "Approvals", href: `${base}?tab=approvals` },
          { key: "contacts", label: "Contacts", href: `${base}?tab=contacts`, count: contacts.length },
          { key: "details", label: "Details", href: `${base}?tab=details` },
        ]}
      />
      {tab === "projects" ? <ProjectsTab slug={slug} workspaceId={ctx.workspace.id} clientId={c.id} /> : null}
      {tab === "approvals" ? (
        <RequestList slug={slug} items={await requestsList(ctx.workspace.id, { clientId: c.id })} />
      ) : null}
      {tab === "contacts" ? (
        <ContactsManager
          slug={slug}
          clientId={c.id}
          contacts={contacts.map((x) => ({ id: x.id, name: x.name, email: x.email, phone: x.phone, designation: x.designation, isApprover: x.isApprover }))}
        />
      ) : null}
      {tab === "details" ? (
        <Card className="p-5">
          <EditClientForm
            slug={slug}
            isAdmin={ctx.isAdmin}
            c={{
              id: c.id,
              name: c.name,
              industry: c.industry,
              website: c.website,
              email: c.email,
              phone: c.phone,
              address: c.address,
              taxId: c.taxId,
              notes: c.notes,
              logoUrl: fileUrl(c.logoKey),
              archivedAt: c.archivedAt?.toISOString() ?? null,
            }}
          />
        </Card>
      ) : null}
    </>
  );
}

async function ProjectsTab({ slug, workspaceId, clientId }: { slug: string; workspaceId: string; clientId: string }) {
  const projects = await projectsList(workspaceId, { clientId, includeArchived: true });
  if (!projects.length)
    return (
      <Card>
        <EmptyState icon={<Briefcase className="h-5 w-5" />} title="No projects yet" description="Create a project to start sending approvals for this client." />
      </Card>
    );
  return <ProjectGrid slug={slug} projects={projects} />;
}

