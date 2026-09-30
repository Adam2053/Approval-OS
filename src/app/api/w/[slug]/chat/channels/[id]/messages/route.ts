import { z } from "zod";
import { json, withWorkspace } from "@/lib/api";
import { channelAccess, ensureMember, listMessages, postMessage } from "@/lib/chat";

type P = { slug: string; id: string };

export const GET = withWorkspace<P>(async (req, ctx, { id }) => {
  const { channel: ch, member } = await channelAccess(ctx, id);
  // Project channels and DMs auto-join so unread tracking works; public channels are joined explicitly.
  if (!member && ch.kind === "project") await ensureMember(ch.id, ctx.user.id);
  const url = new URL(req.url);
  return json(
    await listMessages(ch, ctx.user.id, {
      before: url.searchParams.get("before") ?? undefined,
      parentId: url.searchParams.get("parentId") ?? undefined,
    }),
  );
});

const schema = z.object({
  body: z.string().max(10000).default(""),
  parentId: z.string().nullable().optional(),
  attachments: z
    .array(
      z.object({
        key: z.string(),
        name: z.string(),
        mimeType: z.string(),
        size: z.number(),
        width: z.number().nullable().optional(),
        height: z.number().nullable().optional(),
      }),
    )
    .max(10)
    .optional(),
});

export const POST = withWorkspace<P>(async (req, ctx, { id }) => {
  const { channel: ch } = await channelAccess(ctx, id);
  const input = schema.parse(await req.json());
  const m = await postMessage(ctx, ch, input);
  return json({ id: m.id });
});
