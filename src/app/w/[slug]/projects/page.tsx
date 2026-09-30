import { Briefcase } from "lucide-react";
import Link from "next/link";
import { ProjectGrid } from "@/components/project-grid";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { clientsWithStats, projectsList, workspaceMembers } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { cn } from "@/lib/utils";
import { NewProjectButton } from "./forms";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const { view = "mine" } = await searchParams;
  const ctx = await requireWorkspace(slug);
  const [projects, clients, members] = await Promise.all([
    projectsList(ctx.workspace.id, { userId: view === "mine" ? ctx.user.id : undefined, includeArchived: view === "archived" }),
    clientsWithStats(ctx.workspace.id),
    workspaceMembers(ctx.workspace.id),
  ]);
  const shown = view === "archived" ? projects.filter((p) => p.status === "archived") : projects;
  return (
    <>
      <PageHeader
        title="Projects"
        description="Campaigns and retainers across all clients."
        actions={
          <NewProjectButton
            slug={slug}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            meId={ctx.user.id}
            members={members.map((m) => ({ userId: m.userId, name: m.name, image: m.image, designation: m.designation }))}
          />
        }
      />
      <div className="mb-5 flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm w-fit">
        {[
          ["mine", "My projects"],
          ["all", "All projects"],
          ["archived", "Archived"],
        ].map(([k, label]) => (
          <Link key={k} href={`/w/${slug}/projects?view=${k}`} className={cn("rounded-md px-3 py-1", view === k ? "bg-white font-medium shadow-sm" : "text-zinc-600")}>
            {label}
          </Link>
        ))}
      </div>
      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title={view === "mine" ? "You’re not on any projects yet" : "No projects"}
            description={clients.length ? "Create a project for one of your clients." : "Start by adding a client."}
            action={
              clients.length ? null : (
                <Link href={`/w/${slug}/clients`} className="text-sm font-medium text-brand-600 hover:underline">
                  Go to clients →
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <ProjectGrid slug={slug} projects={shown} />
      )}
    </>
  );
}
