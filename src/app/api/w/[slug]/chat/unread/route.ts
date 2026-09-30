import { json, withWorkspace } from "@/lib/api";
import { totalUnread } from "@/lib/chat";

export const GET = withWorkspace(async (_req, ctx) => json({ total: await totalUnread(ctx) }));
