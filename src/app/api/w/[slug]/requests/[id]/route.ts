import { buildReviewPayload, loadRequest } from "@/lib/approvals";
import { json, withWorkspace } from "@/lib/api";

export const GET = withWorkspace<{ slug: string; id: string }>(async (_req, ctx, { id }) => {
  const loaded = await loadRequest(ctx, id);
  if (!loaded) return json({ error: "Not found" }, { status: 404 });
  return json(await buildReviewPayload(loaded.request, { kind: "team", userId: ctx.user.id, ctx }));
});
