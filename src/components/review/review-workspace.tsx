"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  Lock,
  MapPin,
  MessageSquare,
  MousePointer2,
  Quote,
  RotateCcw,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReviewPayload } from "@/lib/approvals";
import { platformLabel } from "@/lib/status";
import { cn, timeAgo } from "@/lib/utils";
import { usePoll } from "@/lib/use-poll";
import { encodeMentions, MentionTextarea, type MentionMember } from "../mention-textarea";
import { RichText } from "../rich-text";
import { Avatar, Button } from "../ui";

export type Payload = ReviewPayload;
type Comment = Payload["comments"][number];
type Annotation = NonNullable<Comment["annotation"]>;
type Draft = { assetId: string; annotation: Annotation } | { captionQuote: string } | null;
type Tool = "pin" | "box" | "none";

export type ReviewApi = {
  dataUrl: string;
  commentUrl: string;
  /** URL for PATCH/DELETE of one comment. Omit to disable. */
  commentItemUrl?: (id: string) => string;
};

export function ReviewWorkspace({
  initial,
  api,
  members = [],
  onNeedIdentity,
  header,
  sidebarTop,
  footer,
  pollMs = 8000,
}: {
  initial: Payload;
  api: ReviewApi;
  members?: MentionMember[];
  /** Called when an unidentified client tries to interact. */
  onNeedIdentity?: () => void;
  header?: (p: Payload, refresh: () => Promise<void>, versionId: string | null) => ReactNode;
  sidebarTop?: (p: Payload, refresh: () => Promise<void>) => ReactNode;
  footer?: (p: Payload, refresh: () => Promise<void>, versionId: string | null) => ReactNode;
  pollMs?: number;
}) {
  const { data, refresh } = usePoll<Payload>(api.dataUrl, pollMs);
  const p = data ?? initial;
  const isTeam = p.viewer.kind === "team";
  const brand = p.workspace.brandColor;

  const latest = p.versions[p.versions.length - 1] ?? null;
  // null = follow the latest version as new ones arrive.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const version = (pickedId && p.versions.find((v) => v.id === pickedId)) || latest;
  const setVersionId = (id: string) => setPickedId(id === latest?.id ? null : id);

  // Image index is remembered per version and resets when switching versions.
  const [assetPos, setAssetPos] = useState<{ versionId: string | null; idx: number }>({ versionId: null, idx: 0 });
  const assetIdx = assetPos.versionId === version?.id ? assetPos.idx : 0;
  const setAssetIdx = (fn: number | ((i: number) => number)) =>
    setAssetPos({ versionId: version?.id ?? null, idx: typeof fn === "function" ? fn(assetIdx) : fn });
  const assetsList = version?.assets ?? [];
  const current = assetsList[Math.min(assetIdx, assetsList.length - 1)] ?? null;

  const [tool, setTool] = useState<Tool>("pin");
  const [draft, setDraft] = useState<Draft>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const canComment = p.viewer.canComment;
  const isLatest = version?.id === latest?.id;

  const needIdentity = useCallback(() => {
    if (!canComment && p.viewer.kind === "client" && !p.viewer.id) {
      onNeedIdentity?.();
      return true;
    }
    return !canComment;
  }, [canComment, p.viewer, onNeedIdentity]);

  // Comments for the selected version.
  const versionComments = useMemo(() => p.comments.filter((c) => c.versionId === version?.id), [p.comments, version?.id]);
  const roots = versionComments.filter((c) => !c.parentId);
  const repliesOf = useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const c of versionComments) if (c.parentId) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c]);
    return m;
  }, [versionComments]);
  const numberOf = useMemo(() => {
    const m = new Map<string, number>();
    roots.filter((c) => c.annotation).forEach((c, i) => m.set(c.id, i + 1));
    return m;
  }, [roots]);
  const nextNumber = numberOf.size + 1;

  const markers = roots.filter(
    (c) => c.annotation && c.assetId === current?.id && (showResolved || !c.resolvedAt || c.id === activeId),
  );
  const openCount = roots.filter((c) => !c.resolvedAt).length;
  const shownRoots = roots.filter((c) => showResolved || !c.resolvedAt);

  function focusComment(id: string) {
    setActiveId(id);
    const c = roots.find((r) => r.id === id);
    if (c?.assetId) {
      const idx = assetsList.findIndex((a) => a.id === c.assetId);
      if (idx >= 0) setAssetIdx(idx);
    }
    requestAnimationFrame(() => document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function startDraft(d: Draft) {
    if (needIdentity()) return;
    if (!isLatest && !isTeam) return;
    setDraft(d);
    setActiveId(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  return (
    <div className="flex min-h-0 flex-col">
      {header?.(p, refresh, version?.id ?? null)}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ------------------------------ Viewer ------------------------------ */}
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {p.versions.length > 1 ? (
              <div className="flex items-center gap-1 rounded-lg bg-white p-1 ring-1 ring-zinc-200">
                {p.versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVersionId(v.id);
                      setDraft(null);
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-semibold",
                      v.id === version?.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
                    )}
                    title={v.note ?? undefined}
                  >
                    v{v.number}
                  </button>
                ))}
              </div>
            ) : version ? (
              <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold ring-1 ring-zinc-200">v{version.number}</span>
            ) : null}
            {canComment || (p.viewer.kind === "client" && !p.viewer.id) ? (
              <div className="flex items-center gap-1 rounded-lg bg-white p-1 ring-1 ring-zinc-200" role="toolbar" aria-label="Annotation tools">
                {(
                  [
                    ["pin", MapPin, "Pin"],
                    ["box", Square, "Box"],
                    ["none", MousePointer2, "View"],
                  ] as const
                ).map(([t, Icon, label]) => (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                      tool === t ? "bg-brand-600 text-white" : "text-zinc-600 hover:bg-zinc-100",
                    )}
                    style={tool === t ? { background: brand } : undefined}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex-1" />
            {current ? (
              <a href={current.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
                <ExternalLink className="h-3.5 w-3.5" /> Full size
              </a>
            ) : null}
          </div>

          {!isLatest && latest ? (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              <span>
                You’re viewing an older version (v{version?.number}). Latest is v{latest.number}.
              </span>
              <button
                className="font-medium underline"
                onClick={() => setPickedId(null)}
              >
                Go to latest
              </button>
            </div>
          ) : null}

          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 p-2 ring-1 ring-zinc-200 sm:p-4">
            {current ? (
              <AnnotatedImage
                key={current.id}
                src={current.url}
                alt={current.fileName}
                tool={tool}
                brand={brand}
                markers={markers.map((c) => ({
                  id: c.id,
                  n: numberOf.get(c.id) ?? 0,
                  annotation: c.annotation!,
                  internal: c.visibility === "internal",
                  resolved: !!c.resolvedAt,
                  client: c.author.kind === "client",
                }))}
                draft={draft && "assetId" in draft && draft.assetId === current.id ? { n: nextNumber, annotation: draft.annotation } : null}
                activeId={activeId}
                onMarkerClick={focusComment}
                onCreate={(annotation) => startDraft({ assetId: current.id, annotation })}
              />
            ) : (
              <p className="py-20 text-sm text-zinc-500">No images in this version.</p>
            )}
            {assetsList.length > 1 ? (
              <>
                <button
                  className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow ring-1 ring-zinc-200 disabled:opacity-30"
                  disabled={assetIdx === 0}
                  onClick={() => setAssetIdx((i) => Math.max(0, i - 1))}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow ring-1 ring-zinc-200 disabled:opacity-30"
                  disabled={assetIdx >= assetsList.length - 1}
                  onClick={() => setAssetIdx((i) => Math.min(assetsList.length - 1, i + 1))}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  {assetIdx + 1} / {assetsList.length}
                </span>
              </>
            ) : null}
          </div>

          {assetsList.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {assetsList.map((a, i) => {
                const count = roots.filter((c) => c.assetId === a.id && !c.resolvedAt).length;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAssetIdx(i)}
                    className={cn(
                      "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2",
                      i === assetIdx ? "ring-brand-600" : "ring-transparent opacity-70 hover:opacity-100",
                    )}
                    style={i === assetIdx ? { ["--tw-ring-color" as string]: brand } : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.thumbUrl} alt="" className="h-full w-full object-cover" />
                    {count ? (
                      <span className="absolute top-0.5 right-0.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {canComment && tool !== "none" ? (
            <p className="mt-2 text-center text-xs text-zinc-500">
              {tool === "pin" ? "Tap anywhere on the image to drop a pin and comment." : "Drag on the image to draw a box around an area."}
            </p>
          ) : null}
        </section>

        {/* ------------------------------ Sidebar ----------------------------- */}
        <aside className="flex min-w-0 flex-col gap-4">
          {sidebarTop?.(p, refresh)}

          <CaptionCard
            caption={version?.caption ?? p.request.caption}
            platform={p.request.platform}
            brief={p.request.brief}
            canComment={canComment || (p.viewer.kind === "client" && !p.viewer.id)}
            onQuote={(q) => startDraft({ captionQuote: q })}
          />

          {version?.note ? (
            <div className="rounded-xl bg-white p-4 text-sm ring-1 ring-zinc-200">
              <div className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">What changed in v{version.number}</div>
              <p className="whitespace-pre-wrap text-zinc-700">{version.note}</p>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-col rounded-xl bg-white ring-1 ring-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-zinc-400" /> Comments
                <span className="rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-600">{openCount}</span>
              </span>
              {roots.some((c) => c.resolvedAt) ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
                  <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="accent-brand-600" />
                  Show resolved
                </label>
              ) : null}
            </div>
            <div className="max-h-[55vh] min-h-24 space-y-1 overflow-y-auto p-2 scrollbar-thin">
              {shownRoots.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-zinc-500">
                  {canComment ? "No comments yet. Drop a pin on the image or write below." : "No comments yet."}
                </p>
              ) : (
                shownRoots.map((c) => (
                  <CommentThread
                    key={c.id}
                    c={c}
                    n={numberOf.get(c.id)}
                    replies={repliesOf.get(c.id) ?? []}
                    active={activeId === c.id}
                    onFocus={() => focusComment(c.id)}
                    isTeam={isTeam}
                    canReply={canComment}
                    members={members}
                    api={api}
                    refresh={refresh}
                    brand={brand}
                  />
                ))
              )}
            </div>
            {canComment || (p.viewer.kind === "client" && !p.viewer.id) ? (
              <Composer
                ref={composerRef}
                draft={draft}
                nextNumber={nextNumber}
                clearDraft={() => setDraft(null)}
                isTeam={isTeam}
                members={members}
                disabled={!isLatest && !isTeam}
                onBeforeFocus={needIdentity}
                brand={brand}
                onSubmit={async (body, visibility) => {
                  if (needIdentity() || !version) return false;
                  const res = await fetch(api.commentUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      versionId: version.id,
                      body,
                      visibility,
                      assetId: draft && "assetId" in draft ? draft.assetId : null,
                      annotation: draft && "assetId" in draft ? draft.annotation : null,
                      captionQuote: draft && "captionQuote" in draft ? draft.captionQuote : null,
                    }),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    alert(json.error ?? "Could not post comment");
                    return false;
                  }
                  setDraft(null);
                  await refresh();
                  if (json.id) setActiveId(json.id);
                  return true;
                }}
              />
            ) : null}
          </div>
        </aside>
      </div>
      {footer?.(p, refresh, version?.id ?? null)}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Annotated image                               */
/* -------------------------------------------------------------------------- */

type Marker = { id: string; n: number; annotation: Annotation; internal: boolean; resolved: boolean; client: boolean };

function AnnotatedImage({
  src,
  alt,
  tool,
  markers,
  draft,
  activeId,
  onMarkerClick,
  onCreate,
  brand,
}: {
  src: string;
  alt: string;
  tool: Tool;
  markers: Marker[];
  draft: { n: number; annotation: Annotation } | null;
  activeId: string | null;
  onMarkerClick: (id: string) => void;
  onCreate: (a: Annotation) => void;
  brand: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);

  const point = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return { x: clamp((clientX - r.left) / r.width), y: clamp((clientY - r.top) / r.height) };
  };

  const color = (m: { internal: boolean; resolved: boolean }) => (m.resolved ? "#a1a1aa" : m.internal ? "#7c3aed" : brand);

  return (
    <div
      ref={ref}
      className={cn("relative inline-block max-w-full select-none", tool === "box" && "touch-none")}
      style={{ cursor: tool === "none" ? "default" : "crosshair" }}
      onClick={(e) => {
        if (tool !== "pin") return;
        if ((e.target as HTMLElement).closest("[data-marker]")) return;
        const pt = point(e.clientX, e.clientY);
        onCreate({ type: "pin", x: pt.x, y: pt.y });
      }}
      onPointerDown={(e) => {
        if (tool !== "box" || (e.target as HTMLElement).closest("[data-marker]")) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const pt = point(e.clientX, e.clientY);
        setDrag({ x0: pt.x, y0: pt.y, x: pt.x, y: pt.y });
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const pt = point(e.clientX, e.clientY);
        setDrag({ ...drag, x: pt.x, y: pt.y });
      }}
      onPointerUp={() => {
        if (!drag) return;
        const x = Math.min(drag.x0, drag.x);
        const y = Math.min(drag.y0, drag.y);
        const w = Math.abs(drag.x - drag.x0);
        const h = Math.abs(drag.y - drag.y0);
        setDrag(null);
        if (w > 0.015 && h > 0.015) onCreate({ type: "box", x, y, w, h });
        else onCreate({ type: "pin", x: drag.x0, y: drag.y0 });
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} className="block max-h-[72vh] max-w-full rounded-lg shadow-sm" />

      {markers.map((m) => (
        <MarkerView key={m.id} m={m} color={color(m)} active={m.id === activeId} onClick={() => onMarkerClick(m.id)} />
      ))}
      {draft ? (
        <MarkerView m={{ id: "draft", n: draft.n, annotation: draft.annotation, internal: false, resolved: false, client: false }} color={brand} active draft />
      ) : null}
      {drag ? (
        <div
          className="pointer-events-none absolute rounded border-2 border-dashed bg-white/10"
          style={{
            borderColor: brand,
            left: `${Math.min(drag.x0, drag.x) * 100}%`,
            top: `${Math.min(drag.y0, drag.y) * 100}%`,
            width: `${Math.abs(drag.x - drag.x0) * 100}%`,
            height: `${Math.abs(drag.y - drag.y0) * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}

function MarkerView({ m, color, active, onClick, draft }: { m: Marker; color: string; active?: boolean; onClick?: () => void; draft?: boolean }) {
  const a = m.annotation;
  const badge = (
    <span
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md transition-transform",
        active && "scale-125",
        draft && "animate-pulse",
      )}
      style={{ background: color }}
    >
      {m.n}
    </span>
  );
  if (a.type === "pin")
    return (
      <button
        data-marker
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="pin-pop absolute z-10"
        style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, transform: "translate(-50%, -50%)" }}
        aria-label={`Comment ${m.n}`}
      >
        {badge}
      </button>
    );
  return (
    <div
      className="absolute rounded"
      style={{
        left: `${a.x * 100}%`,
        top: `${a.y * 100}%`,
        width: `${a.w * 100}%`,
        height: `${a.h * 100}%`,
        border: `2px solid ${color}`,
        background: active ? `${color}22` : `${color}10`,
        pointerEvents: "none",
      }}
    >
      <button
        data-marker
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="absolute -top-3.5 -left-3.5 z-10"
        style={{ pointerEvents: "auto" }}
        aria-label={`Comment ${m.n}`}
      >
        {badge}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Caption                                    */
/* -------------------------------------------------------------------------- */

function CaptionCard({
  caption,
  platform,
  brief,
  canComment,
  onQuote,
}: {
  caption: string | null;
  platform: string | null;
  brief: string | null;
  canComment: boolean;
  onQuote: (q: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState("");
  useEffect(() => {
    const onSel = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !ref.current) return setSel("");
      const node = s.anchorNode;
      if (node && ref.current.contains(node)) setSel(s.toString().trim().slice(0, 500));
      else setSel("");
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);
  if (!caption && !brief) return null;
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200">
      {brief ? (
        <div className="border-b border-zinc-100 px-4 py-3 text-sm">
          <div className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Notes</div>
          <p className="whitespace-pre-wrap text-zinc-700">{brief}</p>
        </div>
      ) : null}
      {caption ? (
        <div className="px-4 py-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Caption{platform ? ` · ${platformLabel(platform)}` : ""}
            </span>
            {canComment ? <span className="text-[11px] text-zinc-400">Select text to comment on it</span> : null}
          </div>
          <div ref={ref} className="max-h-60 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-zinc-800 scrollbar-thin">
            {caption}
          </div>
          {canComment && sel ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onQuote(sel);
                window.getSelection()?.removeAllRanges();
                setSel("");
              }}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              <Quote className="h-3.5 w-3.5" /> Comment on “{sel.length > 30 ? `${sel.slice(0, 30)}…` : sel}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Comments                                   */
/* -------------------------------------------------------------------------- */

function AuthorLine({ c }: { c: Comment }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs">
      <span className="font-semibold text-zinc-800">{c.author.name}</span>
      <span className="truncate text-zinc-400">
        {c.author.kind === "team" ? [c.author.designation, c.author.agency].filter(Boolean).join(" · ") : "Client"}
      </span>
      <span className="text-zinc-400">· {timeAgo(c.createdAt)}</span>
    </div>
  );
}

function CommentThread({
  c,
  n,
  replies,
  active,
  onFocus,
  isTeam,
  canReply,
  members,
  api,
  refresh,
  brand,
}: {
  c: Comment;
  n?: number;
  replies: Comment[];
  active: boolean;
  onFocus: () => void;
  isTeam: boolean;
  canReply: boolean;
  members: MentionMember[];
  api: ReviewApi;
  refresh: () => Promise<void>;
  brand: string;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);

  async function patch(body: object) {
    if (!api.commentItemUrl) return;
    await fetch(api.commentItemUrl(c.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await refresh();
  }
  async function remove(id: string) {
    if (!api.commentItemUrl || !confirm("Delete this comment?")) return;
    await fetch(api.commentItemUrl(id), { method: "DELETE" });
    await refresh();
  }
  async function reply() {
    const body = isTeam ? encodeMentions(text.trim(), members) : text.trim();
    if (!body) return;
    setBusy(true);
    const res = await fetch(api.commentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: c.versionId, parentId: c.id, body, visibility: c.visibility }),
    });
    setBusy(false);
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "Could not reply");
    setText("");
    setReplying(false);
    await refresh();
  }

  return (
    <div
      id={`c-${c.id}`}
      onClick={onFocus}
      className={cn(
        "cursor-pointer rounded-lg p-3 transition-colors",
        active ? "bg-brand-50/70 ring-1 ring-brand-200" : "hover:bg-zinc-50",
        c.visibility === "internal" && !active && "bg-violet-50/40",
        c.resolvedAt && "opacity-60",
      )}
    >
      <div className="flex gap-2.5">
        {n ? (
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: c.resolvedAt ? "#a1a1aa" : c.visibility === "internal" ? "#7c3aed" : brand }}
          >
            {n}
          </span>
        ) : (
          <Avatar name={c.author.name} size={24} />
        )}
        <div className="min-w-0 flex-1">
          <AuthorLine c={c} />
          <div className="mt-1 flex flex-wrap gap-1">
            {c.visibility === "internal" ? (
              <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                <Lock className="h-2.5 w-2.5" /> Internal
              </span>
            ) : null}
            {c.resolvedAt ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                <CircleCheck className="h-2.5 w-2.5" /> Resolved
              </span>
            ) : null}
          </div>
          {c.captionQuote ? (
            <blockquote className="mt-1.5 border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-900 italic">
              “{c.captionQuote}”
            </blockquote>
          ) : null}
          <div className="mt-1 text-sm break-words text-zinc-800">
            <RichText text={c.body} names={names} />
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500" onClick={(e) => e.stopPropagation()}>
            {canReply ? (
              <button className="hover:text-zinc-900" onClick={() => setReplying((r) => !r)}>
                Reply
              </button>
            ) : null}
            {isTeam && api.commentItemUrl ? (
              <button className="hover:text-zinc-900" onClick={() => patch({ resolved: !c.resolvedAt })}>
                {c.resolvedAt ? (
                  <span className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> Reopen
                  </span>
                ) : (
                  "Resolve"
                )}
              </button>
            ) : null}
            {c.mine && api.commentItemUrl ? (
              <button className="hover:text-rose-600" onClick={() => remove(c.id)} aria-label="Delete">
                <Trash2 className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          {replies.length ? (
            <div className="mt-2 space-y-2 border-l-2 border-zinc-100 pl-3">
              {replies.map((r) => (
                <div key={r.id}>
                  <AuthorLine c={r} />
                  <div className="text-sm break-words text-zinc-800">
                    <RichText text={r.body} names={names} />
                  </div>
                  {r.mine && api.commentItemUrl ? (
                    <button className="text-[11px] text-zinc-400 hover:text-rose-600" onClick={(e) => (e.stopPropagation(), remove(r.id))}>
                      Delete
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {replying ? (
            <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              {isTeam ? (
                <MentionTextarea value={text} onChange={setText} members={members} placeholder="Reply…" autoFocus onSubmit={reply} />
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                  rows={2}
                  placeholder="Reply…"
                  className="block w-full resize-none rounded-lg px-3 py-2 text-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-brand-600"
                />
              )}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={busy || !text.trim()} onClick={reply}>
                  Reply
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


const Composer = forwardRef<
  HTMLTextAreaElement,
  {
    draft: Draft;
    nextNumber: number;
    clearDraft: () => void;
    isTeam: boolean;
    members: MentionMember[];
    disabled?: boolean;
    onBeforeFocus: () => boolean;
    onSubmit: (body: string, visibility: "shared" | "internal") => Promise<boolean>;
    brand: string;
  }
>(function Composer({ draft, nextNumber, clearDraft, isTeam, members, disabled, onBeforeFocus, onSubmit, brand }, ref) {
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const body = isTeam ? encodeMentions(text.trim(), members) : text.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSubmit(body, internal ? "internal" : "shared");
    setBusy(false);
    if (ok) setText("");
  }

  return (
    <div className="border-t border-zinc-100 p-3">
      {draft ? (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600 ring-1 ring-zinc-200">
          <span className="flex min-w-0 items-center gap-1.5">
            {"annotation" in draft ? (
              <>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: brand }}>
                  {nextNumber}
                </span>
                New {draft.annotation.type === "box" ? "area" : "pin"} comment
              </>
            ) : (
              <>
                <Quote className="h-3 w-3 shrink-0" /> <span className="truncate">On caption: “{draft.captionQuote}”</span>
              </>
            )}
          </span>
          <button onClick={clearDraft} className="rounded p-0.5 hover:bg-zinc-200" aria-label="Clear">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
      {disabled ? (
        <p className="text-center text-xs text-zinc-500">Switch to the latest version to comment.</p>
      ) : (
        <>
          <div onFocusCapture={(e) => onBeforeFocus() && (e.target as HTMLElement).blur()}>
            {isTeam ? (
              <MentionTextarea
                ref={ref}
                value={text}
                onChange={setText}
                members={members}
                onSubmit={submit}
                rows={2}
                placeholder={draft ? "Describe the change…" : "Write a comment… (@ to mention, ⌘/Ctrl+Enter to send)"}
              />
            ) : (
              <textarea
                ref={ref}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder={draft ? "Describe the change you’d like…" : "Write a comment…"}
                className="block w-full resize-none rounded-lg px-3 py-2 text-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-brand-600"
              />
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {isTeam ? (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-violet-600" />
                <Lock className="h-3 w-3" /> Internal only
              </label>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={submit} disabled={busy || !text.trim()} style={!isTeam ? { background: brand } : undefined}>
              <Send className="h-3.5 w-3.5" /> {busy ? "Posting…" : "Comment"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
});
