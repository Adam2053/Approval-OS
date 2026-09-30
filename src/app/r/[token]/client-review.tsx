"use client";

import { CalendarClock, CheckCircle2, PartyPopper, PencilLine, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/client-ui";
import { ReviewWorkspace, type Payload } from "@/components/review/review-workspace";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, Button, Field, FormError, Input, Textarea } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";

export function ClientReview({ token, initial, accessKey }: { token: string; initial: Payload; accessKey: string | null }) {
  const [identityOpen, setIdentityOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const base = `/api/review/${token}`;

  // Personal links (?k=…) identify the reviewer automatically.
  useEffect(() => {
    if (!accessKey) return;
    (async () => {
      await fetch(`${base}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("k");
      window.history.replaceState(null, "", url.toString());
      setVersion((v) => v + 1);
    })();
  }, [accessKey, base]);

  const brand = initial.workspace.brandColor;

  return (
    <div className="min-h-dvh bg-zinc-50 pb-28">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Avatar name={initial.workspace.name} src={initial.workspace.logoUrl} size={32} square />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{initial.workspace.name}</div>
            <div className="truncate text-xs text-zinc-500">for {initial.client.name}</div>
          </div>
          <IdentityChip base={base} key={version} onChange={() => setIdentityOpen(true)} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pt-5">
        <ReviewWorkspace
          key={version}
          initial={initial}
          api={{
            dataUrl: `${base}?v=${version}`,
            commentUrl: `${base}/comments`,
            commentItemUrl: (id) => `${base}/comments/${id}`,
          }}
          onNeedIdentity={() => setIdentityOpen(true)}
          pollMs={10000}
          header={(p) => (
            <div className="mb-4">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{p.request.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <StatusBadge status={p.request.status} client />
                <span>Version {p.versions[p.versions.length - 1]?.number ?? 1}</span>
                {p.request.dueAt && !["approved", "cancelled"].includes(p.request.status) ? (
                  <span className="flex items-center gap-1">
                    · <CalendarClock className="h-3.5 w-3.5" /> Please review by {formatDateTime(p.request.dueAt)}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          footer={(p, refresh, versionId) => (
            <DecisionBar p={p} base={base} brand={brand} refresh={refresh} versionId={versionId} onIdentify={() => setIdentityOpen(true)} />
          )}
        />
      </main>
      <IdentityDialog
        open={identityOpen}
        onClose={() => setIdentityOpen(false)}
        base={base}
        brand={brand}
        agency={initial.workspace.name}
        onDone={() => {
          setIdentityOpen(false);
          setVersion((v) => v + 1);
        }}
      />
      <footer className="mt-10 text-center text-xs text-zinc-400">
        Powered by <span className="font-medium">Approval OS</span>
      </footer>
    </div>
  );
}

function IdentityChip({ base, onChange }: { base: string; onChange: () => void }) {
  const [me, setMe] = useState<{ name: string | null; verified?: boolean } | null>(null);
  useEffect(() => {
    fetch(base, { cache: "no-store" })
      .then((r) => r.json())
      .then((p: Payload) => setMe({ name: p.viewer.name, verified: p.viewer.verified }))
      .catch(() => {});
  }, [base]);
  if (!me) return null;
  return me.name ? (
    <button onClick={onChange} className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pr-3 pl-1 text-xs text-zinc-700 hover:bg-zinc-200">
      <Avatar name={me.name} size={22} />
      <span className="max-w-28 truncate">{me.name}</span>
      {me.verified ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : null}
    </button>
  ) : (
    <Button size="sm" variant="secondary" onClick={onChange}>
      <UserRound className="h-4 w-4" /> Sign your name
    </Button>
  );
}

function IdentityDialog({
  open,
  onClose,
  base,
  brand,
  agency,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  base: string;
  brand: string;
  agency: string;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Who’s reviewing?" description={`So ${agency} knows who left the feedback. No account or password needed.`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          const res = await fetch(`${base}/identify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: fd.get("name"), email: fd.get("email") }),
          });
          setBusy(false);
          const json = await res.json().catch(() => ({}));
          if (!res.ok) return setError(json.error ?? "Something went wrong");
          onDone();
        }}
      >
        <FormError message={error} />
        <Field label="Your name">
          <Input name="name" required autoFocus autoComplete="name" />
        </Field>
        <Field label="Work email" hint="Approvers: use the email the agency has on file to be able to approve.">
          <Input name="email" type="email" autoComplete="email" />
        </Field>
        <Button type="submit" className="w-full" disabled={busy} style={{ background: brand }}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </form>
    </Dialog>
  );
}

function DecisionBar({
  p,
  base,
  brand,
  refresh,
  versionId,
  onIdentify,
}: {
  p: Payload;
  base: string;
  brand: string;
  refresh: () => Promise<void>;
  versionId: string | null;
  onIdentify: () => void;
}) {
  const [dialog, setDialog] = useState<null | "approve" | "changes">(null);
  const [note, setNote] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<null | "approved" | "changes_requested">(null);
  const latest = p.versions[p.versions.length - 1];
  const onLatest = versionId === latest?.id;
  const r = p.request;
  const lastDecision = p.decisions[0];
  const openComments = p.comments.filter((c) => c.versionId === latest?.id && !c.parentId && !c.resolvedAt).length;

  const decide = useCallback(
    async (outcome: "approved" | "changes_requested") => {
      if (!latest) return;
      setBusy(true);
      setError(null);
      const res = await fetch(`${base}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: latest.id, outcome, note: note.trim() || null }),
      });
      setBusy(false);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? "Something went wrong");
      setDialog(null);
      setNote("");
      setThanks(outcome);
      await refresh();
    },
    [base, latest, note, refresh],
  );

  let content: React.ReactNode = null;
  if (thanks) {
    content = (
      <div className="flex items-center gap-3 text-sm">
        <PartyPopper className="h-5 w-5 shrink-0" style={{ color: brand }} />
        <span>
          {thanks === "approved" ? "Thank you! Your approval has been recorded" : "Thanks! Your change requests were sent"} and {p.workspace.name} has been notified.
        </span>
      </div>
    );
  } else if (r.status === "approved" && lastDecision) {
    content = (
      <div className="flex items-center gap-3 text-sm text-emerald-800">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <span>
          Approved by <b>{lastDecision.actorName}</b> on {formatDateTime(lastDecision.createdAt)} (v{lastDecision.versionNumber}).
        </span>
      </div>
    );
  } else if (r.status === "changes_requested") {
    content = (
      <div className="flex items-center gap-3 text-sm text-zinc-700">
        <PencilLine className="h-5 w-5 shrink-0 text-rose-500" />
        <span>Changes requested{lastDecision ? ` by ${lastDecision.actorName}` : ""}. {p.workspace.name} is working on a new version, and you’ll get a fresh link.</span>
      </div>
    );
  } else if (r.status === "in_review") {
    if (!onLatest) content = <span className="text-sm text-zinc-600">You’re viewing an older version. Switch to the latest to approve.</span>;
    else if (p.viewer.canApprove)
      content = (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-zinc-600">
            {openComments ? `${openComments} comment${openComments > 1 ? "s" : ""} on this version. ` : ""}Happy with v{latest?.number}?
          </span>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="secondary" size="lg" onClick={() => setDialog("changes")}>
              <PencilLine className="h-4 w-4" /> Request changes
            </Button>
            <Button size="lg" onClick={() => setDialog("approve")} style={{ background: brand }}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          </div>
        </div>
      );
    else if (!p.viewer.id)
      content = (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-zinc-600">Add your name to comment and approve.</span>
          <Button size="lg" onClick={onIdentify} style={{ background: brand }}>
            Start reviewing
          </Button>
        </div>
      );
    else
      content = (
        <span className="text-sm text-zinc-600">
          You can leave comments. The final approval is given by {p.client.name}’s designated approvers.
        </span>
      );
  } else if (r.status === "cancelled") {
    content = <span className="text-sm text-zinc-600">This review was cancelled by {p.workspace.name}.</span>;
  } else {
    content = <span className="text-sm text-zinc-600">{p.workspace.name} is preparing the next version.</span>;
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur">
        <div className={cn("mx-auto flex max-w-7xl items-center px-4 py-3", "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>{content}</div>
      </div>
      <Dialog open={dialog === "approve"} onClose={() => setDialog(null)} title={`Approve “${r.title}”?`} description={`You’re approving version ${latest?.number}. This is recorded with your name and time.`}>
        <div className="space-y-4">
          <FormError message={error} />
          <Field label="Note (optional)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Looks great, go ahead!" />
          </Field>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" style={{ accentColor: brand }} checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
            I confirm this version is approved for publishing.
          </label>
          <Button className="w-full" size="lg" disabled={busy || !confirmChecked} onClick={() => decide("approved")} style={{ background: brand }}>
            {busy ? "Approving…" : "Approve"}
          </Button>
        </div>
      </Dialog>
      <Dialog open={dialog === "changes"} onClose={() => setDialog(null)} title="Request changes" description="Summarise what should change. Your pins and comments are included automatically.">
        <div className="space-y-4">
          <FormError message={error} />
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} autoFocus placeholder="e.g. Make the logo bigger and change the offer to 20% off." />
          <Button className="w-full" size="lg" variant="danger" disabled={busy || !note.trim()} onClick={() => decide("changes_requested")}>
            {busy ? "Sending…" : "Send change requests"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
