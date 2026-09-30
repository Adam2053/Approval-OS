"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import type { AssetInput } from "@/lib/approvals";
import { cn, fileUrl, formatBytes } from "@/lib/utils";

type Item = AssetInput & { uid: string; preview: string };

const strip = (items: Item[]): AssetInput[] =>
  items.map((i) => ({ key: i.key, thumbKey: i.thumbKey, name: i.name, mimeType: i.mimeType, size: i.size, width: i.width, height: i.height }));

/** Drag & drop multi-image uploader. Uploads immediately; parent gets the stored descriptors. */
export function ImageUploader({
  slug,
  value,
  onChange,
  maxMb = 20,
}: {
  slug: string;
  value: AssetInput[];
  onChange: (v: AssetInput[]) => void;
  maxMb?: number;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    value.map((v) => ({ ...v, uid: v.key, preview: fileUrl(v.thumbKey ?? v.key)! })),
  );
  const itemsRef = useRef(items);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function update(next: Item[]) {
    itemsRef.current = next;
    setItems(next);
    onChange(strip(next));
  }

  async function upload(files: File[]) {
    setError(null);
    const images = files.filter((f) => f.type.startsWith("image/") && f.type !== "image/svg+xml");
    if (images.length !== files.length) setError("Only PNG, JPG, WebP, GIF or AVIF images are supported.");
    const tooBig = images.find((f) => f.size > maxMb * 1024 * 1024);
    if (tooBig) return setError(`${tooBig.name} is larger than ${maxMb} MB.`);
    if (!images.length) return;
    setUploading((n) => n + images.length);
    const fd = new FormData();
    fd.set("purpose", "asset");
    images.forEach((f) => fd.append("files", f));
    try {
      const res = await fetch(`/api/w/${slug}/uploads`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      const added: Item[] = json.files.map((f: AssetInput) => ({ ...f, uid: f.key, preview: fileUrl(f.thumbKey ?? f.key)! }));
      update([...itemsRef.current, ...added]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading((n) => n - images.length);
    }
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    update(next);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(Array.from(e.dataTransfer.files));
        }}
        onClick={() => input.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          over ? "border-brand-500 bg-brand-50" : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100",
        )}
      >
        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-brand-600" /> : <ImagePlus className="h-6 w-6 text-zinc-400" />}
        <p className="mt-2 text-sm font-medium text-zinc-700">{uploading ? `Uploading ${uploading}…` : "Drop images here or click to browse"}</p>
        <p className="text-xs text-zinc-500">Single post or a whole carousel · PNG, JPG, WebP · up to {maxMb} MB each</p>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          hidden
          onChange={(e) => {
            upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {items.length ? (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((it, i) => (
            <div key={it.uid} className="group relative overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.preview} alt={it.name} className="aspect-square w-full object-cover" />
              <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">{i + 1}</span>
              <button
                type="button"
                onClick={() => update(items.filter((x) => x.uid !== it.uid))}
                className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-zinc-600 shadow hover:text-rose-600"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="flex items-center justify-between bg-white px-1.5 py-1 text-[10px] text-zinc-500">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30" aria-label="Move left">
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <span className="truncate px-1">{formatBytes(it.size)}</span>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30" aria-label="Move right">
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
