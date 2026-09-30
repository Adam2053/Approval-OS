import { errorResponse, json } from "@/lib/api";
import { createComment } from "@/lib/comments";
import { currentReviewer, requestByToken } from "@/lib/reviewer";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const req = await requestByToken(token);
    if (!req) return json({ error: "This review link is no longer active." }, { status: 404 });
    if (req.status === "cancelled") return json({ error: "This review was cancelled." }, { status: 400 });
    const rv = await currentReviewer(req);
    if (!rv) return json({ error: "Tell us who you are first." }, { status: 401 });
    const created = await createComment(req, { kind: "client", reviewer: rv }, await request.json());
    return json({ id: created.id });
  } catch (e) {
    return errorResponse(e);
  }
}
