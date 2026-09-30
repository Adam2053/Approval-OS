import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { identifyWithDetails, identifyWithKey, requestByToken } from "@/lib/reviewer";

const schema = z.union([
  z.object({ accessKey: z.string().min(4).max(100) }),
  z.object({
    name: z.string().trim().min(1, "Please enter your name").max(120),
    email: z.string().trim().email("Enter a valid email").max(200).nullable().optional().or(z.literal("")),
  }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const req = await requestByToken(token);
    if (!req) return json({ error: "This review link is no longer active." }, { status: 404 });
    const body = schema.parse(await request.json());
    if ("accessKey" in body) {
      const rv = await identifyWithKey(req, body.accessKey);
      if (!rv) return json({ error: "This personal link is not valid for this review." }, { status: 400 });
      return json({ ok: true, name: rv.name });
    }
    const rv = await identifyWithDetails(req, body.name, body.email || null);
    return json({ ok: true, name: rv.name });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return errorResponse(e);
  }
}
