"use client";

import { Briefcase, Hash, Lock, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/client-ui";
import type { MentionMember } from "@/components/mention-textarea";
import { Avatar, Button, Field, FormError, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { usePoll } from "@/lib/use-poll";

type ChannelItem = {
  id: string;
  kind: "public" | "private" | "dm" | "project";
  name: string;
  topic: string | null;
  projectId: string | null;
  isMember: boolean;
  unread: number;
  lastMessageAt: string | null;
  dmUser: { userId: string; name: string; image: string | null } | null;
};

export const CHAT_CHANGED = "aos:chat-changed";

export function ChatShell({ slug, meId, members, children }: { slug: string; meId: string; members: MentionMember[]; children: React.ReactNode }) {
  const params = useParams<{ channelId?: string }>();
  const active = params.channelId ?? null;
  const router = useRouter();
  const { data, refresh } = usePoll<{ channels: ChannelItem[] }>(`/api/w/${slug}/chat/channels`, 5000);
  const [dialog, setDialog] = useState<null | "channel" | "dm">(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const h = () => refresh();
    window.addEventListener(CHAT_CHANGED, h);
    return () => window.removeEventListener(CHAT_CHANGED, h);
  }, [refresh]);

  const all = (data?.channels ?? []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const channels = all.filter((c) => c.kind === "public" || c.kind === "private").sort((a, b) => Number(b.isMember) - Number(a.isMember) || a.name.localeCompare(b.name));
  const projects = all.filter((c) => c.kind === "project").sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  const dms = all.filter((c) => c.kind === "dm").sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));

  const item = (c: ChannelItem) => (
    <Link
      key={c.id}
      href={`/w/${slug}/chat/${c.id}`}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm",
        active === c.id ? "bg-brand-600 text-white" : c.unread ? "font-semibold text-zinc-900 hover:bg-zinc-100" : "text-zinc-600 hover:bg-zinc-100",
        !c.isMember && c.kind === "public" && active !== c.id && "text-zinc-400",
      )}
    >
      {c.kind === "dm" ? (
        <Avatar name={c.name} src={c.dmUser?.image} size={20} />
      ) : c.kind === "private" ? (
        <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />
      ) : c.kind === "project" ? (
        <Briefcase className="h-3.5 w-3.5 shrink-0 opacity-60" />
      ) : (
        <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
      )}
      <span className="min-w-0 flex-1 truncate">{c.name}</span>
      {c.unread ? (
        <span className={cn("rounded-full px-1.5 text-[10px] font-bold", active === c.id ? "bg-white text-brand-700" : "bg-brand-600 text-white")}>{c.unread}</span>
      ) : null}
    </Link>
  );

  return (
    <div className="flex h-full min-h-0">
      <aside className={cn("w-full shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 md:flex md:w-72", active ? "hidden" : "flex")}>
        <div className="border-b border-zinc-200 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a conversation"
              className="h-8 w-full rounded-lg bg-white pr-2 pl-8 text-sm ring-1 ring-zinc-200 outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3 scrollbar-thin">
          <Section title="Channels" onAdd={() => setDialog("channel")}>
            {channels.map(item)}
          </Section>
          {projects.length ? <Section title="Project discussions">{projects.map(item)}</Section> : null}
          <Section title="Direct messages" onAdd={() => setDialog("dm")}>
            {dms.map(item)}
            {dms.length === 0 ? (
              <button onClick={() => setDialog("dm")} className="px-2.5 py-1 text-left text-xs text-zinc-500 hover:text-zinc-800">
                Start a conversation →
              </button>
            ) : null}
          </Section>
        </div>
      </aside>
      <section className={cn("min-w-0 flex-1", active ? "block" : "hidden md:block")}>{children}</section>

      <NewChannelDialog
        open={dialog === "channel"}
        onClose={() => setDialog(null)}
        slug={slug}
        members={members}
        onCreated={(id) => {
          setDialog(null);
          refresh();
          router.push(`/w/${slug}/chat/${id}`);
        }}
      />
      <NewDmDialog
        open={dialog === "dm"}
        onClose={() => setDialog(null)}
        members={members}
        meId={meId}
        onPick={async (ids) => {
          const res = await fetch(`/api/w/${slug}/chat/dm`, { method: "POST", body: JSON.stringify({ userIds: ids }) });
          const json = await res.json();
          setDialog(null);
          refresh();
          router.push(`/w/${slug}/chat/${json.id}`);
        }}
      />
    </div>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-2.5">
        <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{title}</span>
        {onAdd ? (
          <button onClick={onAdd} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" aria-label={`New ${title}`}>
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NewChannelDialog({
  open,
  onClose,
  slug,
  members,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  members: MentionMember[];
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Create a channel" description="Channels are for topics, teams or clients, e.g. #design or #client-chai-point.">
      <NewChannelBody slug={slug} members={members} onCreated={onCreated} />
    </Dialog>
  );
}

function NewChannelBody({ slug, members, onCreated }: { slug: string; members: MentionMember[]; onCreated: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [priv, setPriv] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  return (
    <>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const res = await fetch(`/api/w/${slug}/chat/channels`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: fd.get("name"), topic: fd.get("topic"), kind: priv ? "private" : "public", memberIds: sel }),
          });
          const json = await res.json();
          if (!res.ok) return setError(json.error);
          onCreated(json.id);
        }}
      >
        <FormError message={error} />
        <Field label="Name">
          <Input name="name" required placeholder="design-team" />
        </Field>
        <Field label="Topic (optional)">
          <Input name="topic" placeholder="What’s this channel about?" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          <Lock className="h-3.5 w-3.5" /> Private: only invited people can see it
        </label>
        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">Add people</p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg p-1 ring-1 ring-zinc-200">
            {members.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={sel.includes(m.id)}
                  onChange={(e) => setSel((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))}
                />
                <Avatar name={m.name} src={m.image} size={22} />
                <span className="text-sm">{m.name}</span>
              </label>
            ))}
            {members.length === 0 ? <p className="p-2 text-xs text-zinc-500">Invite teammates from the Team page first.</p> : null}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit">Create channel</Button>
        </div>
      </form>
    </>
  );
}

function NewDmDialog({
  open,
  onClose,
  members,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  members: MentionMember[];
  meId: string;
  onPick: (ids: string[]) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="New message" description="Pick one person for a DM, or several for a group conversation.">
      <NewDmBody members={members} onPick={onPick} />
    </Dialog>
  );
}

function NewDmBody({ members, onPick }: { members: MentionMember[]; onPick: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <>
      {members.length === 0 ? (
        <p className="text-sm text-zinc-500">No teammates yet. Invite people from the Team page.</p>
      ) : (
        <div className="space-y-4">
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {members.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={sel.includes(m.id)}
                  onChange={(e) => setSel((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))}
                />
                <Avatar name={m.name} src={m.image} size={26} />
                <span className="text-sm">
                  {m.name} {m.designation ? <span className="text-zinc-500">· {m.designation}</span> : null}
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button disabled={!sel.length} onClick={() => onPick(sel)}>
              Open conversation
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
