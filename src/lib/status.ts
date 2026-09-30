import type { ApprovalStatus, Platform } from "@/db/schema";

export const STATUS_META: Record<
  ApprovalStatus,
  { label: string; clientLabel: string; tone: string; dot: string }
> = {
  draft: {
    label: "Draft",
    clientLabel: "Draft",
    tone: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    dot: "bg-zinc-400",
  },
  internal_review: {
    label: "Internal review",
    clientLabel: "In preparation",
    tone: "bg-violet-50 text-violet-700 ring-violet-200",
    dot: "bg-violet-500",
  },
  internal_changes: {
    label: "Internal changes",
    clientLabel: "In preparation",
    tone: "bg-orange-50 text-orange-700 ring-orange-200",
    dot: "bg-orange-500",
  },
  ready: {
    label: "Ready to send",
    clientLabel: "In preparation",
    tone: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
  },
  in_review: {
    label: "Waiting on client",
    clientLabel: "Awaiting your review",
    tone: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-500",
  },
  changes_requested: {
    label: "Changes requested",
    clientLabel: "Changes requested",
    tone: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
  },
  approved: {
    label: "Approved",
    clientLabel: "Approved",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    clientLabel: "Cancelled",
    tone: "bg-zinc-100 text-zinc-500 ring-zinc-200",
    dot: "bg-zinc-300",
  },
};

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
  { value: "youtube", label: "YouTube" },
  { value: "threads", label: "Threads" },
  { value: "pinterest", label: "Pinterest" },
  { value: "other", label: "Other" },
];

export function platformLabel(p?: string | null) {
  return PLATFORMS.find((x) => x.value === p)?.label ?? null;
}

export const OPEN_STATUSES: ApprovalStatus[] = [
  "draft",
  "internal_review",
  "internal_changes",
  "ready",
  "in_review",
  "changes_requested",
];
