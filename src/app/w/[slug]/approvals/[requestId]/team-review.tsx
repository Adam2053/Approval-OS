"use client";

import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  History,
  Link2,
  Link2Off,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CopyButton, Dialog, Menu, MenuItem } from "@/components/client-ui";
import type { MentionMember } from "@/components/mention-textarea";
import { ImageUploader } from "@/components/review/image-uploader";
import { ReviewWorkspace, type Payload } from "@/components/review/review-workspace";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, Button, Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import type { AssetInput } from "@/lib/approvals";
import { PLATFORMS, platformLabel } from "@/lib/status";
import { cn, formatDateTime, formatPhone, timeAgo, toLocalInputValue } from "@/lib/utils";
import { approvalShareText, waLink } from "@/lib/whatsapp";
import {
  addVersionAction,
  cancelRequestAction,
  internalDecisionAction,
  reopenRequestAction,
  sendToClientAction,
  setLinkAction,
  submitInternalAction,
  updateDetailsAction,
} from "../actions";

type Refresh = () => Promise<void>;

export function TeamReview({ slug, initial, members, maxMb }: { slug: string; initial: Payload; members: MentionMember[]; maxMb: number }) {
  const id = initial.request.id;
  return (
    <ReviewWorkspace
      initial={initial}
      members={members}
      api={{
        dataUrl: `/api/w/${slug}/requests/${id}`,
        commentUrl: `/api/w/${slug}/requests/${id}/comments`,
        commentItemUrl: (cid) => `/api/w/${slug}/requests/${id}/comments/${cid}`,
      }}
      header={(p, refresh) => <Header slug={slug} p={p} refresh={refresh} maxMb={maxMb} />}
      sidebarTop={(p, refresh) => <SharePanel slug={slug} p={p} refresh={refresh} />}
      footer={(p) => <ActivityPanel p={p} />}
    />
  );
}

/* -------------------------------------------------------------------------- */

function Header({ slug, p, refresh, maxMb }: { slug: string; p: Payload; refresh: Refresh; maxMb: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [dialog, setDialog] = useState<null | "send" | "version" | "internal-changes" | "edit">(() =>
    params.get("send") === "1" ? "send" : null,
  );
  const [busy, setBusy] = useState(false);
  const r = p.request;
  const v = p.viewer;
  const latest = p.versions[p.versions.length - 1];
  const requireInternal = p.project.requireInternalApproval;

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) alert(res.error);
    await refresh();
    router.refresh();
  }

  const primary: React.ReactNode[] = [];
  const sendable = requireInternal
    ? ["ready", "in_review"]
    : ["draft", "ready", "in_review", "internal_review", "internal_changes", ...(latest?.sentAt ? [] : ["changes_requested"])];
  const canSend = v.canWork && sendable.includes(r.status);
  if (r.status === "cancelled") {
    if (v.canCancel)
      primary.push(
        <Button key="reopen" variant="secondary" disabled={busy} onClick={() => act(() => reopenRequestAction(slug, r.id))}>
          <RefreshCw className="h-4 w-4" /> Reopen
        </Button>,
      );
  } else {
    if (v.canWork && ["draft", "internal_changes"].includes(r.status) && requireInternal)
      primary.push(
        <Button key="submit" disabled={busy} onClick={() => act(() => submitInternalAction(slug, r.id))}>
          <ShieldCheck className="h-4 w-4" /> Submit for internal approval
        </Button>,
      );
    if (r.status === "internal_review" && v.canInternalApprove) {
      primary.push(
        <Button key="int-changes" variant="secondary" disabled={busy} onClick={() => setDialog("internal-changes")}>
          <XCircle className="h-4 w-4" /> Request changes
        </Button>,
        <Button
          key="int-approve"
          variant="success"
          disabled={busy}
          onClick={() => confirm(`Approve v${latest?.number} internally? It will be ready to send to the client.`) && act(() => internalDecisionAction(slug, r.id, "approved"))}
        >
          <CheckCircle2 className="h-4 w-4" /> Approve internally
        </Button>,
      );
    }
    if (v.canWork && ["internal_changes", "changes_requested", "approved", "draft", "in_review", "ready", "internal_review"].includes(r.status))
      primary.push(
        <Button key="version" variant={["changes_requested", "internal_changes"].includes(r.status) ? "primary" : "secondary"} disabled={busy} onClick={() => setDialog("version")}>
          <Upload className="h-4 w-4" /> New version
        </Button>,
      );
    if (canSend)
      primary.push(
        <Button key="send" disabled={busy} onClick={() => setDialog("send")}>
          <Send className="h-4 w-4" /> {r.status === "in_review" ? "Remind / resend" : "Send to client"}
        </Button>,
      );
  }

  return (
    <div className="mb-5">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
        <Link href={`/w/${slug}/clients/${p.client.id}`} className="flex items-center gap-1.5 hover:text-zinc-800">
          <Avatar name={p.client.name} src={p.client.logoUrl} size={18} square /> {p.client.name}
        </Link>
        <span>/</span>
        <Link href={`/w/${slug}/projects/${p.project.id}`} className="hover:text-zinc-800">
          {p.project.name}
        </Link>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{r.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <StatusBadge status={r.status} />
            <span>v{r.currentVersion}</span>
            {r.platform ? <span>· {platformLabel(r.platform)}</span> : null}
            {r.dueAt ? (
              <span className={cn("flex items-center gap-1", new Date(r.dueAt) < new Date() && !["approved", "cancelled"].includes(r.status) && "font-medium text-rose-600")}>
                · <CalendarClock className="h-3.5 w-3.5" /> Due {formatDateTime(r.dueAt)}
              </span>
            ) : null}
            {requireInternal ? (
              <span className="flex items-center gap-1 text-violet-600">
                · <ShieldCheck className="h-3.5 w-3.5" /> Internal approval on
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primary}
          <Menu
            trigger={
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  onClick={() => {
                    close();
                    setDialog("edit");
                  }}
                >
                  <Pencil className="h-4 w-4" /> Edit details
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    act(() => setLinkAction(slug, r.id, r.linkEnabled ? "disable" : "enable"));
                  }}
                >
                  {r.linkEnabled ? <Link2Off className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {r.linkEnabled ? "Disable client link" : "Enable client link"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    if (confirm("Generate a new link? The old link (and personal links) will stop working.")) act(() => setLinkAction(slug, r.id, "regenerate"));
                  }}
                >
                  <RefreshCw className="h-4 w-4" /> Regenerate link
                </MenuItem>
                {v.canCancel && r.status !== "cancelled" ? (
                  <MenuItem
                    danger
                    onClick={() => {
                      close();
                      if (confirm("Cancel this approval request?")) act(() => cancelRequestAction(slug, r.id));
                    }}
                  >
                    <Ban className="h-4 w-4" /> Cancel request
                  </MenuItem>
                ) : null}
              </>
            )}
          </Menu>
        </div>
      </div>

      <StatusBanner p={p} />

      <SendDialog open={dialog === "send"} onClose={() => setDialog(null)} slug={slug} p={p} refresh={refresh} />
      <NewVersionDialog open={dialog === "version"} onClose={() => setDialog(null)} slug={slug} p={p} refresh={refresh} maxMb={maxMb} />
      <InternalChangesDialog open={dialog === "internal-changes"} onClose={() => setDialog(null)} slug={slug} p={p} refresh={refresh} />
      <EditDetailsDialog open={dialog === "edit"} onClose={() => setDialog(null)} slug={slug} p={p} refresh={refresh} />
    </div>
  );
}

function StatusBanner({ p }: { p: Payload }) {
  const r = p.request;
  const lastClient = p.decisions.find((d) => d.kind === "client");
  const lastInternal = p.decisions.find((d) => d.kind === "internal");
  let tone = "";
  let text: React.ReactNode = null;
  if (r.status === "approved" && lastClient) {
    tone = "bg-emerald-50 text-emerald-800 ring-emerald-200";
    text = (
      <>
        <b>Approved</b> by {lastClient.actorName}
        {lastClient.actorEmail ? ` (${lastClient.actorEmail})` : ""} on {formatDateTime(lastClient.createdAt)} · v{lastClient.versionNumber}
        {lastClient.identityVerified ? " · verified via personal link" : " · self-identified via shared link"}
        {lastClient.note ? <span className="block">“{lastClient.note}”</span> : null}
      </>
    );
  } else if (r.status === "changes_requested" && lastClient) {
    tone = "bg-rose-50 text-rose-800 ring-rose-200";
    text = (
      <>
        <b>{lastClient.actorName}</b> requested changes on v{lastClient.versionNumber} · {timeAgo(lastClient.createdAt)}
        {lastClient.note ? <span className="block">“{lastClient.note}”</span> : null}
        <span className="block text-xs">Upload a new version once the changes are made.</span>
      </>
    );
  } else if (r.status === "internal_review") {
    tone = "bg-violet-50 text-violet-800 ring-violet-200";
    text = p.viewer.canInternalApprove
      ? "Waiting for your internal approval. Review the creative, leave internal notes, then approve or request changes."
      : "Waiting for internal approval from a teammate or admin (you can’t approve your own version).";
  } else if (r.status === "internal_changes" && lastInternal) {
    tone = "bg-orange-50 text-orange-800 ring-orange-200";
    text = (
      <>
        <b>{lastInternal.actorName}</b> asked for internal changes · {timeAgo(lastInternal.createdAt)}
        {lastInternal.note ? <span className="block">“{lastInternal.note}”</span> : null}
      </>
    );
  } else if (r.status === "ready") {
    tone = "bg-sky-50 text-sky-800 ring-sky-200";
    text = lastInternal ? `Approved internally by ${lastInternal.actorName}. Ready to send to the client.` : "Ready to send to the client.";
  } else if (r.status === "in_review") {
    tone = "bg-amber-50 text-amber-800 ring-amber-200";
    text = "Waiting on the client. They can comment and approve from the link, no login needed.";
  }
  if (!text) return null;
  return <div className={cn("mt-4 rounded-xl px-4 py-3 text-sm ring-1", tone)}>{text}</div>;
}

/* -------------------------------------------------------------------------- */

function SendDialog({ open, onClose, slug, p, refresh }: { open: boolean; onClose: () => void; slug: string; p: Payload; refresh: Refresh }) {
  const [sent, setSent] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={() => {
        setSent(false);
        onClose();
      }}
      title={sent ? "Sent! Share it on WhatsApp too" : "Send to client for approval"}
      description={sent ? undefined : `${p.client.name} · v${p.request.currentVersion}`}
    >
      <SendBody slug={slug} p={p} refresh={refresh} onClose={onClose} onSent={() => setSent(true)} />
    </Dialog>
  );
}

function SendBody({ slug, p, refresh, onClose, onSent }: { slug: string; p: Payload; refresh: Refresh; onClose: () => void; onSent: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() => {
    const recipients = p.recipients.map((r) => r.contactId);
    return recipients.length ? recipients : p.contacts.filter((c) => c.isApprover).map((c) => c.id);
  });
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | { links: { contactId: string; name: string; phone: string | null; email: string | null; url: string }[]; publicUrl: string }>(null);

  const shareText = (url: string, name?: string) =>
    approvalShareText({ agency: p.workspace.name, title: p.request.title, url, dueAt: p.request.dueAt, name });

  return (
    <>
      {result ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            {email && result.links.some((l) => l.email) ? "Emails are on their way. " : ""}Personal links let us verify who approved.
          </div>
          <div className="space-y-2">
            {result.links.map((l) => (
              <div key={l.contactId} className="flex flex-wrap items-center gap-2 rounded-lg p-2 ring-1 ring-zinc-200">
                <Avatar name={l.name} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <div className="truncate text-xs text-zinc-500">{[l.email, l.phone ? formatPhone(l.phone) : null].filter(Boolean).join(" · ")}</div>
                </div>
                <CopyButton text={l.url} label="Link" />
                <a
                  href={waLink(l.phone, shareText(l.url, l.name))}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
            <p className="text-sm font-medium">Sharing in a WhatsApp group?</p>
            <p className="mb-2 text-xs text-zinc-500">Use the shared link. Reviewers enter their name; approvers are matched by email.</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={result.publicUrl} label="Copy group link" />
              <a
                href={waLink(null, shareText(result.publicUrl))}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> Share to group
              </a>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FormError message={error} />
          {p.contacts.length === 0 ? (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              {p.client.name} has no contacts yet.{" "}
              <Link className="font-medium underline" href={`/w/${slug}/clients/${p.client.id}?tab=contacts`}>
                Add a contact
              </Link>{" "}
              or just send and share the group link on WhatsApp.
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm font-medium">Who should review?</p>
              <div className="space-y-1 rounded-lg p-1 ring-1 ring-zinc-200">
                {p.contacts.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-zinc-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={selected.includes(c.id)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))}
                    />
                    <Avatar name={c.name} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {c.name} {c.isApprover ? <span className="text-xs font-normal text-emerald-600">· approver</span> : null}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {[c.designation, c.email, c.phone ? formatPhone(c.phone) : null].filter(Boolean).join(" · ") || "No email or phone"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Field label="Message (optional)">
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Hi! Sharing the final Diwali creatives for your approval." />
          </Field>
          <Checkbox checked={email} onChange={(e) => setEmail(e.target.checked)} label="Email the selected contacts" hint="You’ll also get WhatsApp share buttons on the next step." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const res = await sendToClientAction(slug, p.request.id, { contactIds: selected, message, sendEmail: email });
                setBusy(false);
                if (!res.ok) return setError(res.error);
                setResult(res.data!);
                onSent();
                await refresh();
                router.refresh();
              }}
            >
              <Send className="h-4 w-4" /> {busy ? "Sending…" : p.request.status === "in_review" ? "Resend" : "Send for approval"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function NewVersionDialog({
  open,
  onClose,
  slug,
  p,
  refresh,
  maxMb,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  p: Payload;
  refresh: Refresh;
  maxMb: number;
}) {
  const latest = p.versions[p.versions.length - 1];
  return (
    <Dialog open={open} onClose={onClose} title={`Upload v${(latest?.number ?? 0) + 1}`} description="Upload the revised creatives. The review restarts on the new version." className="max-w-2xl">
      <NewVersionBody slug={slug} p={p} refresh={refresh} maxMb={maxMb} onClose={onClose} />
    </Dialog>
  );
}

function NewVersionBody({ slug, p, refresh, maxMb, onClose }: { slug: string; p: Payload; refresh: Refresh; maxMb: number; onClose: () => void }) {
  const router = useRouter();
  const latest = p.versions[p.versions.length - 1];
  const [assets, setAssets] = useState<AssetInput[]>([]);
  const [note, setNote] = useState("");
  const [caption, setCaption] = useState(latest?.caption ?? p.request.caption ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openThreads = p.comments.filter((c) => c.versionId === latest?.id && !c.parentId && !c.resolvedAt).length;

  return (
    <>
      <div className="space-y-4">
        <FormError message={error} />
        {openThreads ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            {openThreads} unresolved comment{openThreads > 1 ? "s" : ""} on v{latest?.number}. Resolve them as you address them.
          </p>
        ) : null}
        <ImageUploader slug={slug} value={[]} onChange={setAssets} maxMb={maxMb} />
        <Field label="What changed?" hint="Shown to the client next to the new version.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Logo enlarged, price updated to ₹499, font changed." />
        </Field>
        <Field label="Caption">
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !assets.length}
            onClick={async () => {
              setBusy(true);
              const res = await addVersionAction(slug, p.request.id, { note, caption, assets });
              setBusy(false);
              if (!res.ok) return setError(res.error);
              onClose();
              await refresh();
              router.refresh();
            }}
          >
            <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload version"}
          </Button>
        </div>
      </div>
    </>
  );
}

function InternalChangesDialog({ open, onClose, slug, p, refresh }: { open: boolean; onClose: () => void; slug: string; p: Payload; refresh: Refresh }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} title="Request internal changes" description="The client won’t see this. Tip: add internal pins on the image for specifics.">
      <div className="space-y-4">
        <FormError message={error} />
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What needs to change before this goes to the client?" autoFocus />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy || !note.trim()}
            onClick={async () => {
              setBusy(true);
              const res = await internalDecisionAction(slug, p.request.id, "changes_requested", note);
              setBusy(false);
              if (!res.ok) return setError(res.error);
              setNote("");
              onClose();
              await refresh();
            }}
          >
            Request changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function EditDetailsDialog({ open, onClose, slug, p, refresh }: { open: boolean; onClose: () => void; slug: string; p: Payload; refresh: Refresh }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Edit details">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const due = String(fd.get("dueAt") ?? "");
          setBusy(true);
          const res = await updateDetailsAction(slug, p.request.id, {
            title: String(fd.get("title")),
            brief: String(fd.get("brief") ?? "") || null,
            platform: String(fd.get("platform") ?? "") || null,
            dueAt: due ? new Date(due).toISOString() : null,
          });
          setBusy(false);
          if (!res.ok) return setError(res.error);
          onClose();
          await refresh();
          router.refresh();
        }}
      >
        <FormError message={error} />
        <Field label="Title">
          <Input name="title" defaultValue={p.request.title} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Platform">
            <Select name="platform" defaultValue={p.request.platform ?? ""}>
              <option value="">—</option>
              {PLATFORMS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due">
            <Input name="dueAt" type="datetime-local" defaultValue={toLocalInputValue(p.request.dueAt)} />
          </Field>
        </div>
        <Field label="Notes for the client">
          <Textarea name="brief" defaultValue={p.request.brief ?? ""} rows={3} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function SharePanel({ p }: { slug: string; p: Payload; refresh: Refresh }) {
  const r = p.request;
  if (!r.publicUrl) return null;
  const sent = ["in_review", "changes_requested", "approved"].includes(r.status) || p.recipients.length > 0;
  const text = approvalShareText({ agency: p.workspace.name, title: r.title, url: r.publicUrl, dueAt: r.dueAt });
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Client link</span>
        {!r.linkEnabled ? <span className="text-xs font-medium text-rose-600">Disabled</span> : null}
      </div>
      {sent ? (
        <>
          <div className="mb-2 truncate rounded-lg bg-zinc-50 px-2.5 py-1.5 font-mono text-xs text-zinc-600 ring-1 ring-zinc-200">{r.publicUrl}</div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={r.publicUrl} />
            <a
              href={waLink(null, text)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a href={r.publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg px-3 text-sm text-zinc-600 hover:bg-zinc-100">
              Preview
            </a>
          </div>
          {p.recipients.length ? (
            <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
              <p className="text-xs font-medium text-zinc-500">Personal links</p>
              {p.recipients.map((rc) => (
                <div key={rc.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={rc.name} size={22} />
                  <span className="min-w-0 flex-1 truncate">
                    {rc.name}
                    {rc.lastSentAt ? <span className="text-xs text-zinc-400"> · sent {timeAgo(rc.lastSentAt)}</span> : null}
                  </span>
                  <CopyButton text={rc.url} label="" variant="ghost" size="sm" className="px-2" />
                  <a
                    href={waLink(rc.phone, approvalShareText({ agency: p.workspace.name, title: r.title, url: rc.url, dueAt: r.dueAt, name: rc.name }))}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                    title="Send on WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                  {rc.email ? (
                    <a href={`mailto:${rc.email}?subject=${encodeURIComponent(`Approval: ${r.title}`)}&body=${encodeURIComponent(rc.url)}`} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" title="Email">
                      <Mail className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          {p.project.requireInternalApproval
            ? "The link becomes available once this version is approved internally and sent."
            : "Send it to the client to get the review link."}
        </p>
      )}
    </div>
  );
}

const ACTION_TEXT: Record<string, string> = {
  "request.created": "created the request",
  "version.created": "uploaded a new version",
  "internal.submitted": "submitted for internal approval",
  "internal.approved": "approved internally",
  "internal.changes_requested": "requested internal changes",
  "client.sent": "sent to the client",
  "client.resent": "re-sent / reminded the client",
  "client.opened": "opened the review link",
  "client.viewed": "viewed the review",
  "client.commented": "commented",
  "client.approved": "approved",
  "client.changes_requested": "requested changes",
  "request.cancelled": "cancelled the request",
  "request.reopened": "reopened the request",
  "link.enabled": "enabled the client link",
  "link.disabled": "disabled the client link",
  "link.regenerated": "regenerated the client link",
  "reminder.sent": "sent an automatic reminder",
};

function ActivityPanel({ p }: { p: Payload }) {
  const [open, setOpen] = useState(false);
  if (!p.activity.length) return null;
  const items = open ? p.activity : p.activity.slice(0, 6);
  return (
    <div className="mt-6 rounded-xl bg-white ring-1 ring-zinc-200">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 text-sm font-semibold">
        <History className="h-4 w-4 text-zinc-400" /> Activity & approval trail
      </div>
      <ol className="divide-y divide-zinc-50">
        {items.map((a) => {
          const meta = (a.meta ?? {}) as Record<string, unknown>;
          return (
            <li key={a.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300" />
              <div className="min-w-0 flex-1">
                <b className="font-medium">{a.actorName}</b> {ACTION_TEXT[a.action] ?? a.action}
                {typeof meta.version === "number" ? <span className="text-zinc-500"> (v{meta.version as number})</span> : null}
                {typeof meta.note === "string" && meta.note ? <span className="block text-zinc-500">“{meta.note}”</span> : null}
              </div>
              <span className="shrink-0 text-xs text-zinc-400" title={formatDateTime(a.createdAt)}>
                {timeAgo(a.createdAt)}
              </span>
            </li>
          );
        })}
      </ol>
      {p.activity.length > 6 ? (
        <button className="w-full border-t border-zinc-100 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50" onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : `Show all ${p.activity.length}`}
        </button>
      ) : null}
    </div>
  );
}
