import { buildReviewPayload } from "@/lib/approvals";
import { errorResponse, json } from "@/lib/api";
import { currentReviewer, requestByToken, touchReviewer } from "@/lib/reviewer";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const req = await requestByToken(token);
    if (!req) return json({ error: "This review link is no longer active." }, { status: 404 });
    const rv = await currentReviewer(req);
    if (rv) await touchReviewer(req, rv);
    return json(await buildReviewPayload(req, { kind: "client", reviewer: rv }));
  } catch (e) {
    return errorResponse(e);
  }
}
