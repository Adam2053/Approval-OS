"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { approvalRequest, type Platform } from "@/db/schema";
import {
  addVersion,
  cancelRequest,
  createRequest,
  internalDecision,
  loadRequest,
  reopenRequest,
  sendToClient,
  submitForInternalReview,
  type AssetInput,
} from "@/lib/approvals";
import { logActivity } from "@/lib/events";
import { requireWorkspace } from "@/lib/session";
import { randomToken } from "@/lib/utils";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Something went wrong" };
  }
}

const assetSchema = z.array(
  z.object({
    key: z.string(),
    thumbKey: z.string().nullable().optional(),
    name: z.string(),
    mimeType: z.string(),
    size: z.number(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
  }),
);

const createSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  brief: z.string().trim().max(5000).nullable().optional(),
  caption: z.string().max(10000).nullable().optional(),
  platform: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  assets: assetSchema.min(1, "Add at least one image"),
  intent: z.enum(["draft", "submit"]),
});

export async function createRequestAction(slug: string, projectId: string, input: z.input<typeof createSchema>) {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    const data = createSchema.parse(input);
    const req = await createRequest(ctx, {
      projectId,
      title: data.title,
      brief: data.brief,
      caption: data.caption,
      platform: data.platform,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      assets: data.assets as AssetInput[],
    });
    if (data.intent === "submit") await submitForInternalReview(ctx, req.id);
    revalidatePath(`/w/${slug}/projects/${projectId}`);
    return { id: req.id };
  });
}

export async function addVersionAction(
  slug: string,
  requestId: string,
  input: { note?: string | null; caption?: string | null; assets: AssetInput[] },
) {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    const assets = assetSchema.min(1, "Add at least one image").parse(input.assets);
    await addVersion(ctx, requestId, { note: input.note, caption: input.caption, assets });
    revalidatePath(`/w/${slug}/approvals/${requestId}`);
  });
}

export async function submitInternalAction(slug: string, requestId: string) {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    await submitForInternalReview(ctx, requestId);
    revalidatePath(`/w/${slug}/approvals/${requestId}`);
  });
}

export async function internalDecisionAction(slug: string, requestId: string, outcome: "approved" | "changes_requested", note?: string) {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    await internalDecision(ctx, requestId, outcome, note);
    revalidatePath(`/w/${slug}/approvals/${requestId}`);
  });
}

export async function sendToClientAction(
  slug: string,
  requestId: string,
  input: { contactIds: string[]; message?: string; sendEmail: boolean },
) {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    const res = await sendToClient(ctx, requestId, input);
    revalidatePath(`/w/${slug}/approvals/${requestId}`);
    return res;
  });
}

export async function cancelRequestAction(slug: string, requestId: string) {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    await cancelRequest(ctx, requestId);
    revalidatePath(`/w/${slug}/approvals/${requestId}`);
  });
}

export async function reopenRequestAction(slug: string, requestId: string) {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    await reopenRequest(ctx, requestId);
    revalidatePath(`/w/${slug}/approvals/${requestId}`);
  });
}

const detailsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  brief: z.string().trim().max(5000).nullable().optional(),
  platform: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export async function updateDetailsAction(slug: string, requestId: string, input: z.input<typeof detailsSchema>) {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    const loaded = await loadRequest(ctx, requestId);
    if (!loaded) throw new Error("Not found");
    const d = detailsSchema.parse(input);
    await db
      .update(approvalRequest)
      .set({
        title: d.title,
        brief: d.brief || null,
        platform: (d.platform || null) as Platform | null,
        dueAt: d.dueAt ? new Date(d.dueAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(approvalRequest.id, requestId));
    revalidatePath(`/w/${slug}/approvals/${requestId}`);
  });
}

export async function setLinkAction(slug: string, requestId: string, op: "enable" | "disable" | "regenerate") {
  return run(async () => {
    const ctx = await requireWorkspace(slug);
    const loaded = await loadRequest(ctx, requestId);
    if (!loaded) throw new Error("Not found");
    const set =
      op === "regenerate" ? { shareToken: randomToken(18), linkEnabled: true } : { linkEnabled: op === "enable" };
    await db
      .update(approvalRequest)
      .set(set)
      .where(and(eq(approvalRequest.id, requestId), eq(approvalRequest.workspaceId, ctx.workspace.id)));
    await logActivity({
      workspaceId: ctx.workspace.id,
      requestId,
      projectId: loaded.project.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name,
      action: `link.${op}d`,
    });
    revalidatePath(`/w/${slug}/approvals/${requestId}`);
  });
}
