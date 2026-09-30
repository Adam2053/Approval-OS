import { getObject } from "@/lib/storage";

// SVG/HTML are never rendered inline, which prevents script injection through uploads.
const SAFE_INLINE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "application/pdf"]);

/**
 * Serves uploaded files. Keys contain a random UUID, so a file URL works like a capability link:
 * the client review page can load creatives without a login.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const k = key.map(decodeURIComponent).join("/");
  if (!k.startsWith("ws/") || k.includes("..")) return new Response("Not found", { status: 404 });
  const obj = await getObject(k);
  if (!obj) return new Response("Not found", { status: 404 });
  if ("redirect" in obj) return Response.redirect(obj.redirect, 302);
  const inline = SAFE_INLINE.has(obj.contentType);
  const name = k.split("/").pop() ?? "file";
  return new Response(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
