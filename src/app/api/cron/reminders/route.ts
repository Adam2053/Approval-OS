import { and, eq, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { approvalRecipient, approvalRequest, clientContact, workspace } from "@/db/schema";
import { reviewUrl } from "@/lib/approvals";
import { emailLayout, sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/events";
import { formatDateTime } from "@/lib/utils";

/**
 * Sends due-date reminders to client approvers for requests waiting on them.
 * Fires when a request is due within 24h or overdue, at most once every 24h per request.
 * Call hourly from a cron (Vercel Cron, GitHub Actions, crontab) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const due = await db
    .select({ request: approvalRequest, workspace })
    .from(approvalRequest)
    .innerJoin(workspace, eq(workspace.id, approvalRequest.workspaceId))
    .where(
      and(
        eq(approvalRequest.status, "in_review"),
        eq(approvalRequest.linkEnabled, true),
        isNotNull(approvalRequest.dueAt),
        lte(approvalRequest.dueAt, soon),
        or(isNull(approvalRequest.lastReminderAt), lt(approvalRequest.lastReminderAt, dayAgo)),
      ),
    )
    .limit(200);

  let sent = 0;
  for (const { request: r, workspace: ws } of due) {
    const recipients = await db
      .select({ name: clientContact.name, email: clientContact.email, accessKey: approvalRecipient.accessKey })
      .from(approvalRecipient)
      .innerJoin(clientContact, eq(clientContact.id, approvalRecipient.contactId))
      .where(and(eq(approvalRecipient.requestId, r.id), eq(clientContact.isApprover, true)));
    const overdue = r.dueAt! < now;
    for (const rc of recipients) {
      if (!rc.email) continue;
      const { html, text } = emailLayout({
        brand: ws.name,
        color: ws.brandColor,
        heading: overdue ? `Overdue: “${r.title}” is waiting for your approval` : `Reminder: “${r.title}” is due soon`,
        lines: [
          `Hi ${rc.name.split(" ")[0]},`,
          `${ws.name} is waiting on your review of “${r.title}”${overdue ? `. It was due ${formatDateTime(r.dueAt, ws.timezone)}` : `, due ${formatDateTime(r.dueAt, ws.timezone)}`}.`,
          "It only takes a minute: open the link, leave comments or approve.",
        ],
        cta: { label: "Review now", url: reviewUrl(r.shareToken, rc.accessKey) },
      });
      await sendEmail({ to: rc.email, subject: `${overdue ? "Overdue" : "Reminder"}: approval needed for ${r.title}`, html, text });
      sent++;
    }
    await db.update(approvalRequest).set({ lastReminderAt: now }).where(eq(approvalRequest.id, r.id));
    await logActivity({
      workspaceId: r.workspaceId,
      requestId: r.id,
      projectId: r.projectId,
      actorName: "Approval OS",
      action: "reminder.sent",
      meta: { recipients: recipients.length, overdue },
    });
  }
  return Response.json({ requests: due.length, emails: sent });
}
