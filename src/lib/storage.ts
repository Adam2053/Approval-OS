import "server-only";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * File storage. Uses any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO) when
 * S3_BUCKET is set, otherwise the local ./.data/uploads folder.
 */
const bucket = process.env.S3_BUCKET;
const localRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR ?? ".data/uploads");

let s3: S3Client | null = null;
function client() {
  s3 ??= new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_FORCE_PATH_STYLE),
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  return s3;
}

function localPath(key: string) {
  const p = path.resolve(/*turbopackIgnore: true*/ localRoot, key);
  if (!p.startsWith(localRoot + path.sep)) throw new Error("Invalid key");
  return p;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (bucket) {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
    return;
  }
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
  await writeFile(`${p}.meta`, JSON.stringify({ contentType }));
}

/** Returns either a redirect URL (S3) or the file bytes (local). */
export async function getObject(
  key: string,
): Promise<{ redirect: string } | { body: Buffer; contentType: string } | null> {
  if (bucket) {
    const url = await getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: 60 * 60,
    });
    return { redirect: url };
  }
  try {
    const p = localPath(key);
    await stat(p);
    const body = await readFile(p);
    let contentType = "application/octet-stream";
    try {
      contentType = JSON.parse(await readFile(`${p}.meta`, "utf8")).contentType ?? contentType;
    } catch {}
    return { body, contentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  if (bucket) {
    await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  try {
    const p = localPath(key);
    await unlink(p);
    await unlink(`${p}.meta`).catch(() => {});
  } catch {}
}
