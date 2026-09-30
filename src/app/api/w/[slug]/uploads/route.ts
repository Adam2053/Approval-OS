import sharp from "sharp";
import { json, withWorkspace } from "@/lib/api";
import { env } from "@/lib/env";
import { putObject } from "@/lib/storage";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const MAX_FILES = 20;

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
}

/**
 * Multipart upload. `purpose=asset` (approval creatives) and `purpose=logo` accept images only.
 * `purpose=attachment` (chat) accepts any file. Returns descriptors that other endpoints store.
 */
export const POST = withWorkspace(async (req, ctx) => {
  const form = await req.formData();
  const purpose = String(form.get("purpose") ?? "attachment");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return json({ error: "No files" }, { status: 400 });
  if (files.length > MAX_FILES) return json({ error: `Up to ${MAX_FILES} files at a time` }, { status: 400 });

  const out = [];
  for (const file of files) {
    if (file.size > env.maxUploadMb * 1024 * 1024)
      return json({ error: `${file.name} is larger than ${env.maxUploadMb} MB` }, { status: 413 });
    const isImage = IMAGE_TYPES.has(file.type);
    if ((purpose === "asset" || purpose === "logo") && !isImage)
      return json({ error: `${file.name} isn't a supported image (PNG, JPG, WebP, GIF, AVIF)` }, { status: 415 });

    const id = crypto.randomUUID();
    const buf = Buffer.from(await file.arrayBuffer());
    const key = `ws/${ctx.workspace.id}/${purpose}/${id}/${safeName(file.name)}`;
    let width: number | null = null;
    let height: number | null = null;
    let thumbKey: string | null = null;

    if (isImage) {
      try {
        const img = sharp(buf, { animated: false }).rotate();
        const meta = await img.metadata();
        const oriented = (meta.orientation ?? 1) >= 5;
        width = (oriented ? meta.height : meta.width) ?? null;
        height = (oriented ? meta.width : meta.height) ?? null;
        const thumb = await sharp(buf).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        thumbKey = `ws/${ctx.workspace.id}/${purpose}/${id}/thumb.webp`;
        await putObject(thumbKey, thumb, "image/webp");
      } catch (e) {
        console.warn("[upload] could not read image", e);
      }
    }
    await putObject(key, buf, file.type || "application/octet-stream");
    out.push({ key, thumbKey, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, width, height });
  }
  return json({ files: out });
});
