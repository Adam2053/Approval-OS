import "server-only";
import { workspaceForApi, type WorkspaceContext } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
  const message = err instanceof Error ? err.message : "Something went wrong";
  console.error("[api]", err);
  return json({ error: message }, { status: 400 });
}

/** Wraps a workspace-scoped route handler: resolves the member context or returns 401. */
export function withWorkspace<P extends { slug: string }>(
  handler: (req: Request, ctx: WorkspaceContext, params: P) => Promise<Response>,
) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    try {
      const p = await params;
      const ctx = await workspaceForApi(p.slug);
      if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
      return await handler(req, ctx, p);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null
  );
}
