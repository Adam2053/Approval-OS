import { CalendarClock, FileCheck2, Images } from "lucide-react";
import Link from "next/link";
import type { RequestListItem } from "@/lib/queries";
import { platformLabel } from "@/lib/status";
import { cn, formatDate, nowMs, timeAgo } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import { Avatar, EmptyState } from "./ui";

export function RequestList({
  slug,
  items,
  showProject = true,
  empty,
}: {
  slug: string;
  items: RequestListItem[];
  showProject?: boolean;
  empty?: React.ReactNode;
}) {
  if (!items.length)
    return (
      <div className="rounded-xl bg-white ring-1 ring-zinc-200">
        {empty ?? <EmptyState icon={<FileCheck2 className="h-5 w-5" />} title="No approvals here yet" />}
      </div>
    );
  const now = nowMs();
  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
      {items.map((r) => {
        const overdue = r.dueAt && r.dueAt.getTime() < now && !["approved", "cancelled"].includes(r.status);
        return (
          <Link key={r.id} href={`/w/${slug}/approvals/${r.id}`} className="flex items-center gap-4 p-3 transition-colors hover:bg-zinc-50 sm:p-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-200">
              {r.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : null}
              {r.imageCount > 1 ? (
                <span className="absolute right-0.5 bottom-0.5 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                  <Images className="h-2.5 w-2.5" /> {r.imageCount}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate font-medium text-zinc-900">{r.title}</span>
                <span className="text-xs text-zinc-400">v{r.currentVersion}</span>
              </div>
              <div className="mt-0.5 truncate text-sm text-zinc-500">
                {showProject ? `${r.clientName} · ${r.projectName}` : r.clientName}
                {r.platform ? ` · ${platformLabel(r.platform)}` : ""}
              </div>
            </div>
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <StatusBadge status={r.status} />
              <span className={cn("flex items-center gap-1 text-xs", overdue ? "font-medium text-rose-600" : "text-zinc-400")}>
                {r.dueAt ? (
                  <>
                    <CalendarClock className="h-3 w-3" /> {overdue ? "Overdue · " : "Due "}
                    {formatDate(r.dueAt)}
                  </>
                ) : (
                  `Updated ${timeAgo(r.updatedAt)}`
                )}
              </span>
            </div>
            <div className="sm:hidden">
              <StatusBadge status={r.status} />
            </div>
            <Avatar name={r.creatorName} src={r.creatorImage} size={28} className="hidden md:inline-flex" />
          </Link>
        );
      })}
    </div>
  );
}
