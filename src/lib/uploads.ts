import "server-only";
import sharp from "sharp";
import { putObject } from "./storage";

/** Resizes an uploaded logo/avatar to a 256px square-ish webp and stores it. Returns the key or null. */
export async function saveLogo(workspaceId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new Error("Logo must be a PNG, JPG or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Logo must be under 5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const out = await sharp(buf).rotate().resize({ width: 256, height: 256, fit: "cover" }).webp({ quality: 85 }).toBuffer();
  const key = `ws/${workspaceId}/logo/${crypto.randomUUID()}.webp`;
  await putObject(key, out, "image/webp");
  return key;
}
