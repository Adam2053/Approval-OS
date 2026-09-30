import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { membership, workspace } from "@/db/schema";
import { requireUser } from "@/lib/session";

/** Entry point after sign-in: go to the user's first workspace, or create one. */
export default async function AppEntry() {
  const user = await requireUser("/app");
  const [first] = await db
    .select({ slug: workspace.slug })
    .from(membership)
    .innerJoin(workspace, eq(workspace.id, membership.workspaceId))
    .where(eq(membership.userId, user.id))
    .orderBy(asc(membership.createdAt))
    .limit(1);
  redirect(first ? `/w/${first.slug}` : "/onboarding");
}
