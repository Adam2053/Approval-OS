"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { createWorkspace } from "@/lib/workspaces";

const schema = z.object({
  name: z.string().trim().min(2, "Give your agency a name").max(80),
  designation: z.string().trim().max(60).optional(),
  timezone: z.string().trim().max(60).optional(),
});

export async function createWorkspaceAction(_: unknown, fd: FormData) {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const ws = await createWorkspace({ ...parsed.data, userId: user.id });
  redirect(`/w/${ws.slug}?welcome=1`);
}
