import { and, eq, gt, isNull } from "drizzle-orm";
import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Avatar, Card } from "@/components/ui";
import { db } from "@/db";
import { invitation, workspace } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { fileUrl } from "@/lib/utils";
import { userWorkspaces } from "@/lib/workspaces";
import { CreateWorkspaceForm } from "./create-workspace-form";

export const metadata = { title: "Create a workspace" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const mine = await userWorkspaces(user.id);
  const invites = await db
    .select({ token: invitation.token, name: workspace.name })
    .from(invitation)
    .innerJoin(workspace, eq(workspace.id, invitation.workspaceId))
    .where(
      and(
        eq(invitation.email, user.email.toLowerCase()),
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
        gt(invitation.expiresAt, new Date()),
      ),
    );

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-brand-50 to-zinc-50 px-4 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-md space-y-6">
        {invites.length > 0 ? (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">You’ve been invited</h2>
            <div className="space-y-2">
              {invites.map((i) => (
                <Link
                  key={i.token}
                  href={`/invite/${i.token}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-zinc-200 hover:bg-zinc-50"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-brand-600" /> Join <b>{i.name}</b>
                  </span>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </Link>
              ))}
            </div>
          </Card>
        ) : null}
        {mine.length > 0 ? (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Your workspaces</h2>
            <div className="space-y-2">
              {mine.map((w) => (
                <Link
                  key={w.id}
                  href={`/w/${w.slug}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-zinc-200 hover:bg-zinc-50"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Avatar name={w.name} src={fileUrl(w.logoKey)} size={24} square /> {w.name}
                  </span>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </Link>
              ))}
            </div>
          </Card>
        ) : null}
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{mine.length ? "Create another workspace" : `Welcome, ${user.name.split(" ")[0]} 👋`}</h1>
          <p className="mt-1 mb-6 text-sm text-zinc-500">
            A workspace is your agency. It holds your team, clients, projects and approvals. You can belong to several.
          </p>
          <CreateWorkspaceForm />
        </Card>
      </div>
    </div>
  );
}
