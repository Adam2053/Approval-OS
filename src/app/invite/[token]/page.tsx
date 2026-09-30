import { and, eq, gt, isNull } from "drizzle-orm";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/client-ui";
import { Avatar, Card, LinkButton } from "@/components/ui";
import { db } from "@/db";
import { invitation, user as userTable, workspace } from "@/db/schema";
import { getUser } from "@/lib/session";
import { fileUrl } from "@/lib/utils";
import { acceptInvite } from "./actions";

export const metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getUser();
  const [row] = await db
    .select({ invitation, workspace, inviter: userTable.name })
    .from(invitation)
    .innerJoin(workspace, eq(workspace.id, invitation.workspaceId))
    .leftJoin(userTable, eq(userTable.id, invitation.invitedBy))
    .where(
      and(eq(invitation.token, token), isNull(invitation.acceptedAt), isNull(invitation.revokedAt), gt(invitation.expiresAt, new Date())),
    )
    .limit(1);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-zinc-50 px-4 py-12">
      <Logo className="mb-8" />
      <Card className="w-full max-w-sm p-6 text-center">
        {!row ? (
          <>
            <h1 className="text-lg font-semibold">This invite isn’t valid anymore</h1>
            <p className="mt-2 text-sm text-zinc-500">It may have expired, been used already, or been revoked. Ask your admin for a new link.</p>
            <LinkButton href="/app" variant="secondary" className="mt-6">
              Go to Approval OS
            </LinkButton>
          </>
        ) : (
          <>
            <Avatar name={row.workspace.name} src={fileUrl(row.workspace.logoKey)} size={56} square className="mx-auto" />
            <h1 className="mt-4 text-lg font-semibold">Join {row.workspace.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {row.inviter ? `${row.inviter} invited you` : "You’ve been invited"} as{" "}
              <b className="text-zinc-700">{row.invitation.designation || row.invitation.role}</b>.
            </p>
            {user ? (
              <form action={acceptInvite.bind(null, token)} className="mt-6 space-y-3">
                <SubmitButton className="w-full" pendingText="Joining…">
                  Accept & join as {user.name.split(" ")[0]}
                </SubmitButton>
                {user.email.toLowerCase() !== row.invitation.email.toLowerCase() ? (
                  <p className="text-xs text-amber-700">
                    Heads up: this invite was sent to {row.invitation.email}, and you’re signed in as {user.email}.
                  </p>
                ) : null}
              </form>
            ) : (
              <div className="mt-6 space-y-2">
                <LinkButton
                  className="w-full"
                  href={`/sign-up?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(row.invitation.email)}`}
                >
                  Create account to join
                </LinkButton>
                <LinkButton
                  variant="secondary"
                  className="w-full"
                  href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(row.invitation.email)}`}
                >
                  I already have an account
                </LinkButton>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
