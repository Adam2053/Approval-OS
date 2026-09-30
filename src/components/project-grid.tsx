import Link from "next/link";
import type { projectsList } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { Avatar, Card } from "./ui";

export function ProjectGrid({ slug, projects }: { slug: string; projects: Awaited<ReturnType<typeof projectsList>> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <Link key={p.id} href={`/w/${slug}/projects/${p.id}`}>
          <Card className="flex h-full flex-col p-5 transition hover:shadow-md hover:ring-brand-200">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="truncate text-sm text-zinc-500">{p.clientName}</div>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-600">{p.status.replace("_", " ")}</span>
            </div>
            {p.description ? <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{p.description}</p> : null}
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p.total ? (p.approved / p.total) * 100 : 0}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>
                {p.approved}/{p.total} approved · {p.open} open
              </span>
              {p.dueDate ? <span>Due {formatDate(p.dueDate)}</span> : null}
            </div>
            <div className="mt-auto flex -space-x-2 pt-4">
              {p.members.slice(0, 5).map((m) => (
                <Avatar key={m.userId} name={m.name} src={m.image} size={26} className="ring-2 ring-white" />
              ))}
              {p.members.length > 5 ? <span className="pl-3 text-xs text-zinc-500">+{p.members.length - 5}</span> : null}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
