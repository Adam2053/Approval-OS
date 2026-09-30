import { loadRequest } from "@/lib/approvals";
import { json, withWorkspace } from "@/lib/api";
import { createComment } from "@/lib/comments";

export const POST = withWorkspace<{ slug: string; id: string }>(async (req, ctx, { id }) => {
  const loaded = await loadRequest(ctx, id);
  if (!loaded) return json({ error: "Not found" }, { status: 404 });
  const created = await createComment(
    loaded.request,
    { kind: "team", userId: ctx.user.id, name: ctx.user.name, slug: ctx.workspace.slug },
    await req.json(),
  );
  return json({ id: created.id });
});
