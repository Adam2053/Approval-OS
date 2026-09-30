import { z } from "zod";
import { clientDecision } from "@/lib/approvals";
import { clientIp, errorResponse, json } from "@/lib/api";
import { currentReviewer, requestByToken } from "@/lib/reviewer";

const schema = z.object({
  versionId: z.string(),
  outcome: z.enum(["approved", "changes_requested"]),
  note: z.string().trim().max(5000).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const req = await requestByToken(token);
    if (!req) return json({ error: "This review link is no longer active." }, { status: 404 });
    const rv = await currentReviewer(req);
    if (!rv) return json({ error: "Tell us who you are first." }, { status: 401 });
    const body = schema.parse(await request.json());
    if (body.outcome === "changes_requested" && !body.note)
      return json({ error: "Please describe the changes you’d like." }, { status: 400 });
    await clientDecision({
      request: req,
      reviewer: rv,
      versionId: body.versionId,
      outcome: body.outcome,
      note: body.note,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
