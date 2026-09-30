"use client";

import {
  ArrowLeft,
  FileIcon,
  FileCheck2,
  Gavel,
  Hash,
  Loader2,
  Lock,
  MessageSquareReply,
  Paperclip,
  Pencil,
  SmilePlus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";
import { cn, formatBytes, formatDate, formatTime } from "@/lib/utils";
import { usePoll } from "@/lib/use-poll";
import { Dialog } from "../client-ui";
import { decodeMentions, encodeMentions, MentionTextarea, type MentionMember } from "../mention-textarea";
import { RichText } from "../rich-text";
import { StatusBadge } from "../status-badge";
import { Avatar, Button, Field, Input, Textarea } from "../ui";

const EMOJIS = ["👍", "✅", "❤️", "😂", "🎉", "👀", "🙏", "🔥"];

type ChannelInfo = {
  id: string;
  kind: "public" | "private" | "dm" | "project";
  name: string;
  topic: string | null;
  projectId: string | null;
  isMember: boolean;
  isDefault: boolean;
  canManage: boolean;
  members: { id: string; name: string; image: string | null }[];
};

type Attachment = ChatMessage["attachments"][number];
type Upload = Omit<Attachment, "url">;

export function ChannelView({
  slug,
  channelId,
  me,
  members,
  embedded,
  backHref,
  onChanged,
}: {
  slug: string;
  channelId: string;
  me: { id: string; name: string };
  members: MentionMember[];
  embedded?: boolean;
  backHref?: string;
  onChanged?: () => void;
}) {
  const base = `/api/w/${slug}/chat`;
  const { data: info, refresh: refreshInfo } = usePoll<ChannelInfo>(`${base}/channels/${channelId}`, 30000);
  const { data, refresh } = usePoll<{ messages: ChatMessage[]; hasMore: boolean }>(`${base}/channels/${channelId}/messages`, 3000);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [addPeople, setAddPeople] = useState(false);
  const [decisionFor, setDecisionFor] = useState<ChatMessage | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const names = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);

  const messages = useMemo(() => {
    const latest = data?.messages ?? [];
    const ids = new Set(latest.map((m) => m.id));
    return [...older.filter((m) => !ids.has(m.id)), ...latest];
  }, [older, data]);
  const hasMore = hasMoreOlder ?? data?.hasMore ?? false;
  const lastId = messages[messages.length - 1]?.id;

  // Keep pinned to the bottom when new messages arrive, and mark as read.
  useEffect(() => {
    const el = scroller.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
    if (lastId && document.visibilityState === "visible") {
      fetch(`${base}/channels/${channelId}/read`, { method: "POST" }).then(() => onChanged?.());
    }
  }, [lastId, base, channelId, onChanged]);

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await fetch(`${base}/channels/${channelId}/messages?before=${encodeURIComponent(first.createdAt)}`);
    const json = (await res.json()) as { messages: ChatMessage[]; hasMore: boolean };
    setOlder((o) => [...json.messages, ...o]);
    setHasMoreOlder(json.hasMore);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  const react = useCallback(
    async (id: string, emoji: string) => {
      await fetch(`${base}/messages/${id}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) });
      refresh();
    },
    [base, refresh],
  );

  const joinable = info && info.kind === "public" && !info.isMember;
  const title =
    info?.kind === "dm"
      ? info.members.filter((m) => m.id !== me.id).map((m) => m.name).join(", ") || "Notes to self"
      : (info?.name ?? "");

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {!embedded ? (
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
            {backHref ? (
              <Link href={backHref} className="-ml-1 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 md:hidden" aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-semibold">
                {info?.kind === "private" ? <Lock className="h-4 w-4 text-zinc-400" /> : info?.kind === "dm" ? null : <Hash className="h-4 w-4 text-zinc-400" />}
                <span className="truncate">{title}</span>
                {info?.kind === "project" && info.projectId ? (
                  <Link href={`/w/${slug}/projects/${info.projectId}`} className="ml-1 text-xs font-normal text-brand-600 hover:underline">
                    Open project
                  </Link>
                ) : null}
              </div>
              {info?.topic ? <div className="truncate text-xs text-zinc-500">{info.topic}</div> : null}
            </div>
            {info && info.kind !== "dm" ? (
              <div className="flex items-center gap-1">
                <div className="mr-1 hidden -space-x-1.5 sm:flex">
                  {info.members.slice(0, 4).map((m) => (
                    <Avatar key={m.id} name={m.name} src={m.image} size={24} className="ring-2 ring-white" />
                  ))}
                  {info.members.length > 4 ? <span className="pl-2.5 text-xs text-zinc-500">+{info.members.length - 4}</span> : null}
                </div>
                {info.isMember ? (
                  <Button variant="ghost" size="sm" onClick={() => setAddPeople(true)} title="Add people">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                ) : null}
                {info.isMember && !info.isDefault && info.kind !== "project" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Leave ${title}?`)) return;
                      await fetch(`${base}/channels/${channelId}/members`, { method: "DELETE" });
                      refreshInfo();
                      onChanged?.();
                    }}
                  >
                    Leave
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto bg-white px-2 py-3 scrollbar-thin sm:px-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
        >
          {hasMore ? (
            <div className="mb-3 text-center">
              <Button variant="secondary" size="sm" onClick={loadOlder}>
                Load earlier messages
              </Button>
            </div>
          ) : null}
          {!data ? (
            <div className="flex h-full items-center justify-center text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-zinc-100 p-3 text-zinc-400">
                {info?.kind === "project" ? <Gavel className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
              </div>
              <p className="mt-3 text-sm font-medium">
                {info?.kind === "project" ? "Start the project discussion" : info?.kind === "dm" ? `This is the start of your conversation with ${title}` : `Welcome to #${info?.name ?? ""}`}
              </p>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                {info?.kind === "project"
                  ? "Discuss direction, share references, and hover any message to log it as a decision."
                  : "Say hi, share files, and @mention teammates."}
              </p>
            </div>
          ) : (
            <MessageList
              messages={messages}
              names={names}
              slug={slug}
              onReact={react}
              onThread={setThread}
              onDecision={info?.kind === "project" ? setDecisionFor : undefined}
              base={base}
              members={members}
              refresh={refresh}
            />
          )}
        </div>

        {joinable ? (
          <div className="border-t border-zinc-200 bg-zinc-50 p-4 text-center">
            <p className="mb-2 text-sm text-zinc-600">You’re viewing #{info!.name}.</p>
            <Button
              onClick={async () => {
                await fetch(`${base}/channels/${channelId}/members`, { method: "POST", body: "{}" });
                refreshInfo();
                onChanged?.();
              }}
            >
              Join channel
            </Button>
          </div>
        ) : (
          <Composer
            slug={slug}
            members={members}
            placeholder={info?.kind === "dm" ? `Message ${title}` : info?.kind === "project" ? "Message the project team…" : `Message #${info?.name ?? ""}`}
            onSend={async (body, attachments) => {
              const res = await fetch(`${base}/channels/${channelId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body, attachments }),
              });
              if (!res.ok) {
                alert((await res.json().catch(() => ({}))).error ?? "Could not send");
                return false;
              }
              nearBottom.current = true;
              await refresh();
              return true;
            }}
          />
        )}
      </div>

      {thread ? (
        <ThreadPanel
          base={base}
          slug={slug}
          channelId={channelId}
          parentId={thread}
          names={names}
          members={members}
          onClose={() => setThread(null)}
          onReact={react}
          onPosted={refresh}
        />
      ) : null}

      <AddPeopleDialog
        open={addPeople}
        onClose={() => setAddPeople(false)}
        members={members.filter((m) => !info?.members.some((x) => x.id === m.id))}
        onAdd={async (ids) => {
          await fetch(`${base}/channels/${channelId}/members`, { method: "POST", body: JSON.stringify({ userIds: ids }) });
          setAddPeople(false);
          refreshInfo();
        }}
      />
      <DecisionDialog
        message={decisionFor}
        onClose={() => setDecisionFor(null)}
        names={names}
        onSave={async (title, details) => {
          await fetch(`${base}/messages/${decisionFor!.id}/decision`, { method: "POST", body: JSON.stringify({ title, details }) });
          setDecisionFor(null);
          alert("Logged to the project’s decision log.");
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return formatDate(d);
}

function MessageList({
  messages,
  names,
  slug,
  onReact,
  onThread,
  onDecision,
  base,
  members,
  refresh,
  inThread,
}: {
  messages: ChatMessage[];
  names: Record<string, string>;
  slug: string;
  onReact: (id: string, emoji: string) => void;
  onThread?: (id: string) => void;
  onDecision?: (m: ChatMessage) => void;
  base: string;
  members: MentionMember[];
  refresh: () => Promise<void>;
  inThread?: boolean;
}) {
  return (
    <div>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
        const compact =
          !newDay &&
          prev &&
          !prev.system &&
          !m.system &&
          prev.user?.id === m.user?.id &&
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000 &&
          !(inThread && i === 1);
        return (
          <Fragment key={m.id}>
            {newDay && !inThread ? (
              <div className="my-3 flex items-center gap-3 text-xs font-medium text-zinc-400">
                <div className="h-px flex-1 bg-zinc-100" />
                {dayLabel(m.createdAt)}
                <div className="h-px flex-1 bg-zinc-100" />
              </div>
            ) : null}
            <MessageRow
              m={m}
              compact={!!compact}
              names={names}
              slug={slug}
              onReact={onReact}
              onThread={onThread}
              onDecision={onDecision}
              base={base}
              members={members}
              refresh={refresh}
            />
            {inThread && i === 0 && messages.length > 1 ? (
              <div className="my-2 flex items-center gap-3 text-xs text-zinc-400">
                <div className="h-px flex-1 bg-zinc-100" />
                {messages.length - 1} {messages.length === 2 ? "reply" : "replies"}
                <div className="h-px flex-1 bg-zinc-100" />
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

function MessageRow({
  m,
  compact,
  names,
  slug,
  onReact,
  onThread,
  onDecision,
  base,
  members,
  refresh,
}: {
  m: ChatMessage;
  compact: boolean;
  names: Record<string, string>;
  slug: string;
  onReact: (id: string, emoji: string) => void;
  onThread?: (id: string) => void;
  onDecision?: (m: ChatMessage) => void;
  base: string;
  members: MentionMember[];
  refresh: () => Promise<void>;
}) {
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  if (m.system)
    return (
      <div className="my-2 flex items-start gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
        <div className="min-w-0 flex-1">
          <RichText text={m.body} names={names} />
          {m.request ? (
            <Link href={`/w/${slug}/approvals/${m.request.id}`} className="ml-2 inline-flex items-center gap-1 align-middle">
              <StatusBadge status={m.request.status as Parameters<typeof StatusBadge>[0]["status"]} />
            </Link>
          ) : null}
        </div>
        <span className="text-[11px] text-zinc-400">{formatTime(m.createdAt)}</span>
      </div>
    );

  return (
    <div className={cn("group relative flex gap-3 rounded-lg px-2 hover:bg-zinc-50", compact ? "py-0.5" : "mt-2 py-1.5")}>
      <div className="w-9 shrink-0">
        {!compact ? (
          <Avatar name={m.user?.name ?? "Deleted user"} src={m.user?.image} size={36} />
        ) : (
          <span className="hidden pt-1 text-[10px] text-zinc-400 group-hover:block">{formatTime(m.createdAt)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!compact ? (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{m.user?.name ?? "Deleted user"}</span>
            <span className="text-[11px] text-zinc-400">{formatTime(m.createdAt)}</span>
          </div>
        ) : null}
        {m.deleted ? (
          <p className="text-sm text-zinc-400 italic">This message was deleted.</p>
        ) : editing ? (
          <div className="space-y-2 py-1">
            <MentionTextarea
              value={text}
              onChange={setText}
              members={members}
              autoFocus
              enterToSend
              onSubmit={async () => {
                await fetch(`${base}/messages/${m.id}`, { method: "PATCH", body: JSON.stringify({ body: encodeMentions(text, members) }) });
                setEditing(false);
                refresh();
              }}
            />
            <div className="flex gap-2 text-xs">
              <button className="text-zinc-500" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <span className="text-zinc-400">Enter to save</span>
            </div>
          </div>
        ) : (
          <>
            {m.body ? (
              <div className="text-sm leading-relaxed break-words text-zinc-800">
                <RichText text={m.body} names={names} />
                {m.editedAt ? <span className="ml-1 text-[10px] text-zinc-400">(edited)</span> : null}
              </div>
            ) : null}
            {m.attachments.length ? <Attachments items={m.attachments} /> : null}
          </>
        )}
        {m.reactions.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(m.id, r.emoji)}
                title={r.names.join(", ")}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1",
                  r.mine ? "bg-brand-50 ring-brand-200" : "bg-white ring-zinc-200 hover:bg-zinc-50",
                )}
              >
                {r.emoji} <span className="font-medium text-zinc-600">{r.count}</span>
              </button>
            ))}
          </div>
        ) : null}
        {onThread && m.replyCount > 0 ? (
          <button onClick={() => onThread(m.id)} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
            <MessageSquareReply className="h-3.5 w-3.5" /> {m.replyCount} {m.replyCount === 1 ? "reply" : "replies"}
          </button>
        ) : null}
      </div>

      {!m.deleted && !editing ? (
        <div className="absolute -top-3 right-2 z-10 hidden items-center rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-zinc-200 group-hover:flex">
          <div className="relative">
            <IconBtn title="React" onClick={() => setPicker((p) => !p)}>
              <SmilePlus className="h-4 w-4" />
            </IconBtn>
            {picker ? (
              <div className="absolute top-full right-0 z-20 mt-1 flex gap-0.5 rounded-lg bg-white p-1 shadow-lg ring-1 ring-zinc-200" onMouseLeave={() => setPicker(false)}>
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    className="rounded p-1 text-base hover:bg-zinc-100"
                    onClick={() => {
                      onReact(m.id, e);
                      setPicker(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {onThread ? (
            <IconBtn title="Reply in thread" onClick={() => onThread(m.id)}>
              <MessageSquareReply className="h-4 w-4" />
            </IconBtn>
          ) : null}
          {onDecision ? (
            <IconBtn title="Log as decision" onClick={() => onDecision(m)}>
              <Gavel className="h-4 w-4" />
            </IconBtn>
          ) : null}
          {m.mine ? (
            <IconBtn
              title="Edit"
              onClick={() => {
                setText(decodeMentions(m.body, members));
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </IconBtn>
          ) : null}
          {m.mine ? (
            <IconBtn
              title="Delete"
              onClick={async () => {
                if (!confirm("Delete this message?")) return;
                await fetch(`${base}/messages/${m.id}`, { method: "DELETE" });
                refresh();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </IconBtn>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
      {children}
    </button>
  );
}

function Attachments({ items }: { items: Attachment[] }) {
  const images = items.filter((a) => /^image\/(png|jpe?g|webp|gif|avif)$/.test(a.mimeType));
  const files = items.filter((a) => !images.includes(a));
  return (
    <div className="mt-1.5 space-y-1.5">
      {images.length ? (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <a key={a.key} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="max-h-60 max-w-[min(100%,20rem)] object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
      {files.map((a) => (
        <a key={a.key} href={a.url} target="_blank" rel="noreferrer" className="flex max-w-xs items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 hover:bg-zinc-50">
          <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">{a.name}</span>
          <span className="text-xs text-zinc-400">{formatBytes(a.size)}</span>
        </a>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Composer({
  slug,
  members,
  placeholder,
  onSend,
  compact,
}: {
  slug: string;
  members: MentionMember[];
  placeholder: string;
  onSend: (body: string, attachments: Upload[]) => Promise<boolean>;
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(list: File[]) {
    if (!list.length) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("purpose", "attachment");
    list.slice(0, 10).forEach((f) => fd.append("files", f));
    const res = await fetch(`/api/w/${slug}/uploads`, { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return alert(json.error ?? "Upload failed");
    setFiles((f) => [...f, ...json.files.map((x: Upload) => ({ key: x.key, name: x.name, mimeType: x.mimeType, size: x.size, width: x.width, height: x.height }))]);
  }

  async function send() {
    const body = encodeMentions(text.trim(), members);
    if ((!body && !files.length) || sending || uploading) return;
    setSending(true);
    const ok = await onSend(body, files);
    setSending(false);
    if (ok) {
      setText("");
      setFiles([]);
    }
  }

  return (
    <div
      className={cn("shrink-0 border-t border-zinc-200 bg-white", compact ? "p-2" : "p-3")}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        upload(Array.from(e.dataTransfer.files));
      }}
      onPaste={(e) => {
        const f = Array.from(e.clipboardData.files);
        if (f.length) {
          e.preventDefault();
          upload(f);
        }
      }}
    >
      {files.length || uploading ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <span key={f.key} className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3" /> <span className="max-w-40 truncate">{f.name}</span>
              <button onClick={() => setFiles((x) => x.filter((y) => y.key !== f.key))} aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {uploading ? (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <button onClick={() => input.current?.click()} className="mb-1 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" title="Attach files" aria-label="Attach files">
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <div className="min-w-0 flex-1">
          <MentionTextarea value={text} onChange={setText} members={members} placeholder={placeholder} onSubmit={send} enterToSend rows={1} className="max-h-40 min-h-10" />
        </div>
        <Button onClick={send} disabled={sending || uploading || (!text.trim() && !files.length)} className="mb-0.5">
          Send
        </Button>
      </div>
      {!compact ? <p className="mt-1 hidden text-[11px] text-zinc-400 sm:block">Enter to send · Shift+Enter for a new line · @ to mention · paste or drop files</p> : null}
    </div>
  );
}

function ThreadPanel({
  base,
  slug,
  channelId,
  parentId,
  names,
  members,
  onClose,
  onReact,
  onPosted,
}: {
  base: string;
  slug: string;
  channelId: string;
  parentId: string;
  names: Record<string, string>;
  members: MentionMember[];
  onClose: () => void;
  onReact: (id: string, emoji: string) => void;
  onPosted: () => void;
}) {
  const { data, refresh } = usePoll<{ messages: ChatMessage[] }>(`${base}/channels/${channelId}/messages?parentId=${parentId}`, 3000);
  const react = async (id: string, emoji: string) => {
    await onReact(id, emoji);
    refresh();
  };
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white md:static md:z-auto md:w-96 md:border-l md:border-zinc-200">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
        <span className="font-semibold">Thread</span>
        <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100" aria-label="Close thread">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
        {data ? (
          <MessageList messages={data.messages} names={names} slug={slug} onReact={react} base={base} members={members} refresh={refresh} inThread />
        ) : (
          <div className="flex justify-center p-6 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
      <Composer
        slug={slug}
        members={members}
        placeholder="Reply in thread…"
        compact
        onSend={async (body, attachments) => {
          const res = await fetch(`${base}/channels/${channelId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body, attachments, parentId }),
          });
          if (!res.ok) return false;
          await refresh();
          onPosted();
          return true;
        }}
      />
    </div>
  );
}

function AddPeopleDialog({
  open,
  onClose,
  members,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  members: MentionMember[];
  onAdd: (ids: string[]) => Promise<void>;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Add people">
      <AddPeopleBody members={members} onAdd={onAdd} />
    </Dialog>
  );
}

function AddPeopleBody({ members, onAdd }: { members: MentionMember[]; onAdd: (ids: string[]) => Promise<void> }) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <>
      {members.length === 0 ? (
        <p className="text-sm text-zinc-500">Everyone is already here.</p>
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
                <span className="text-sm">{m.name}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button disabled={!sel.length} onClick={() => onAdd(sel)}>
              Add {sel.length || ""}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function DecisionDialog({
  message,
  onClose,
  onSave,
  names,
}: {
  message: ChatMessage | null;
  onClose: () => void;
  onSave: (title: string, details: string) => Promise<void>;
  names: Record<string, string>;
}) {
  return (
    <Dialog open={!!message} onClose={onClose} title="Log as decision" description="Adds this to the project’s decision log so it’s easy to find later.">
      {message ? <DecisionBody key={message.id} message={message} names={names} onClose={onClose} onSave={onSave} /> : null}
    </Dialog>
  );
}

function DecisionBody({
  message,
  names,
  onClose,
  onSave,
}: {
  message: ChatMessage;
  names: Record<string, string>;
  onClose: () => void;
  onSave: (title: string, details: string) => Promise<void>;
}) {
  const plain = message.body.replace(/<@([\w-]+)>/g, (_, id) => `@${names[id] ?? "someone"}`);
  const [title, setTitle] = useState(plain.split("\n")[0]?.slice(0, 200) ?? "");
  const [details, setDetails] = useState(plain);
  return (
    <>
      <div className="space-y-4">
        <Field label="Decision">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Details">
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim()} onClick={() => onSave(title, details)}>
            <Gavel className="h-4 w-4" /> Log decision
          </Button>
        </div>
      </div>
    </>
  );
}
