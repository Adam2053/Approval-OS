import { Building2 } from "lucide-react";
import Link from "next/link";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { clientsWithStats } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { NewClientButton } from "./forms";

export const metadata = { title: "Clients" };

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ archived?: string }>;
}) {
  const { slug } = await params;
  const { archived } = await searchParams;
  const ctx = await requireWorkspace(slug);
  const clients = await clientsWithStats(ctx.workspace.id, archived === "1");
  return (
    <>
      <PageHeader
        title="Clients"
        description="Brands you create for, their contacts and projects."
        actions={
          <>
            <Link href={archived === "1" ? `/w/${slug}/clients` : `/w/${slug}/clients?archived=1`} className="text-sm text-zinc-500 hover:text-zinc-800">
              {archived === "1" ? "Hide archived" : "Show archived"}
            </Link>
            <NewClientButton slug={slug} />
          </>
        }
      />
      {clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No clients yet"
            description="Add your first client, then create a project and send your first approval."
            action={<NewClientButton slug={slug} />}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/w/${slug}/clients/${c.id}`}>
              <Card className="h-full p-5 transition hover:shadow-md hover:ring-brand-200">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} src={c.logoUrl} size={44} square />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="truncate text-sm text-zinc-500">{c.industry ?? "—"}</div>
                  </div>
                  {c.archivedAt ? <span className="ml-auto text-xs text-zinc-400">Archived</span> : null}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Projects", c.projects],
                    ["Open", c.openApprovals],
                    ["Contacts", c.contacts],
                  ].map(([label, n]) => (
                    <div key={label} className="rounded-lg bg-zinc-50 py-2">
                      <div className="text-lg font-semibold">{n}</div>
                      <div className="text-xs text-zinc-500">{label}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
