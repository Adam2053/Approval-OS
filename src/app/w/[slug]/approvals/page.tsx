import { Search } from "lucide-react";
import Link from "next/link";
import { RequestList } from "@/components/request-list";
import { PageHeader } from "@/components/ui";
import type { ApprovalStatus } from "@/db/schema";
import { requestsList } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Approvals" };

const FILTERS: { key: string; label: string; statuses?: ApprovalStatus[]; overdue?: boolean; mine?: boolean }[] = [
  { key: "open", label: "All open", statuses: ["draft", "internal_review", "internal_changes", "ready", "in_review", "changes_requested"] },
  { key: "internal", label: "Internal review", statuses: ["internal_review"] },
  { key: "ready", label: "Ready to send", statuses: ["ready"] },
  { key: "client", label: "Waiting on client", statuses: ["in_review"] },
  { key: "changes", label: "Changes requested", statuses: ["changes_requested", "internal_changes"] },
  { key: "overdue", label: "Overdue", overdue: true },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "mine", label: "Created by me", mine: true },
  { key: "all", label: "Everything" },
];

export default async function ApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const { slug } = await params;
  const { f = "open", q } = await searchParams;
  const ctx = await requireWorkspace(slug);
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0]!;
  const items = await requestsList(ctx.workspace.id, {
    statuses: filter.statuses,
    overdue: filter.overdue,
    createdBy: filter.mine ? ctx.user.id : undefined,
    q: q?.trim() || undefined,
  });
  return (
    <>
      <PageHeader title="Approvals" description="Everything waiting on your team or your clients." />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-thin">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={`/w/${slug}/approvals?f=${x.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm whitespace-nowrap",
                x.key === filter.key ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50",
              )}
            >
              {x.label}
            </Link>
          ))}
        </div>
        <form className="relative md:w-64">
          <input type="hidden" name="f" value={filter.key} />
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search approvals…"
            className="h-9 w-full rounded-lg bg-white pr-3 pl-9 text-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-brand-600"
          />
        </form>
      </div>
      <RequestList slug={slug} items={items} />
    </>
  );
}
