import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { membership, projectMember, workspace, type WorkspaceRole } from "@/db/schema";
import { getAuth } from "./auth";

export type SessionUser = { id: string; name: string; email: string; image?: string | null };

export const getSession = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session;
});

export async function getUser(): Promise<SessionUser | null> {
  const s = await getSession();
  return s?.user ?? null;
}

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  return user;
}

export type WorkspaceContext = {
  user: SessionUser;
  workspace: typeof workspace.$inferSelect;
  membership: typeof membership.$inferSelect;
  role: WorkspaceRole;
  isAdmin: boolean;
};

/** Loads the workspace by slug and checks the signed-in user belongs to it. */
export const requireWorkspace = cache(async (slug: string): Promise<WorkspaceContext> => {
  const user = await requireUser(`/w/${slug}`);
  const rows = await db
    .select({ workspace, membership })
    .from(workspace)
    .innerJoin(membership, and(eq(membership.workspaceId, workspace.id), eq(membership.userId, user.id)))
    .where(eq(workspace.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  return {
    user,
    workspace: row.workspace,
    membership: row.membership,
    role: row.membership.role,
    isAdmin: isAdminRole(row.membership.role),
  };
});

/** Same as requireWorkspace, for route handlers: returns null instead of redirecting. */
export async function workspaceForApi(slugOrId: string, by: "slug" | "id" = "slug") {
  const user = await getUser();
  if (!user) return null;
  const rows = await db
    .select({ workspace, membership })
    .from(workspace)
    .innerJoin(membership, and(eq(membership.workspaceId, workspace.id), eq(membership.userId, user.id)))
    .where(by === "slug" ? eq(workspace.slug, slugOrId) : eq(workspace.id, slugOrId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    user,
    workspace: row.workspace,
    membership: row.membership,
    role: row.membership.role,
    isAdmin: isAdminRole(row.membership.role),
  } satisfies WorkspaceContext;
}

export function isAdminRole(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export async function isProjectMember(projectId: string, userId: string) {
  const rows = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** Anyone assigned to the project (or a workspace admin/owner) can raise approval requests. */
export async function canWorkOnProject(ctx: WorkspaceContext, projectId: string) {
  return ctx.isAdmin || (await isProjectMember(projectId, ctx.user.id));
}
