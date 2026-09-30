import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { comment } from "@/db/schema";
import { errorResponse, json } from "@/lib/api";
import { currentReviewer, requestByToken } from "@/lib/reviewer";

export async function DELETE(_request: Request, { params }: { params: Promise<{ token: string; commentId: string }> }) {
  try {
    const { token, commentId } = await params;
    const req = await requestByToken(token);
    if (!req) return json({ error: "Not found" }, { status: 404 });
    const rv = await currentReviewer(req);
    if (!rv) return json({ error: "Unauthorized" }, { status: 401 });
    await db
      .update(comment)
      .set({ deletedAt: new Date() })
      .where(and(eq(comment.id, commentId), eq(comment.requestId, req.id), eq(comment.authorReviewerId, rv.id)));
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
