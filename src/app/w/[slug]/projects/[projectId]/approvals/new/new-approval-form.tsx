"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageUploader } from "@/components/review/image-uploader";
import { Button, Card, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import type { AssetInput } from "@/lib/approvals";
import { PLATFORMS } from "@/lib/status";
import { createRequestAction } from "../../../../approvals/actions";

export function NewApprovalForm({
  slug,
  projectId,
  requireInternalApproval,
  maxMb,
}: {
  slug: string;
  projectId: string;
  requireInternalApproval: boolean;
  maxMb: number;
}) {
  const router = useRouter();
  const [assets, setAssets] = useState<AssetInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "draft" | "submit" | "send">(null);
  const [caption, setCaption] = useState("");

  async function save(fd: FormData, intent: "draft" | "submit" | "send") {
    setError(null);
    setPending(intent);
    const due = String(fd.get("dueAt") ?? "");
    const res = await createRequestAction(slug, projectId, {
      title: String(fd.get("title") ?? ""),
      brief: String(fd.get("brief") ?? "") || null,
      caption: caption || null,
      platform: String(fd.get("platform") ?? "") || null,
      dueAt: due ? new Date(due).toISOString() : null,
      assets,
      intent: intent === "submit" ? "submit" : "draft",
    });
    if (!res.ok) {
      setPending(null);
      return setError(res.error);
    }
    router.push(`/w/${slug}/approvals/${res.data!.id}${intent === "send" ? "?send=1" : ""}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        save(new FormData(e.currentTarget), (submitter?.value as "draft" | "submit" | "send") ?? "draft");
      }}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Creatives</h2>
          <ImageUploader slug={slug} value={assets} onChange={setAssets} maxMb={maxMb} />
        </Card>
        <Card className="p-5">
          <Field label="Caption / copy" hint="The client can highlight any part of it and comment.">
            <Textarea
              name="caption"
              rows={8}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={"Write the post caption, hashtags, CTA…"}
            />
          </Field>
          <p className="mt-1 text-right text-xs text-zinc-400">{caption.length} characters</p>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <FormError message={error} />
          <Field label="Title">
            <Input name="title" required placeholder="e.g. Diwali Offer: Carousel" />
          </Field>
          <Field label="Platform">
            <Select name="platform" defaultValue="instagram">
              <option value="">—</option>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Approval needed by">
            <Input name="dueAt" type="datetime-local" />
          </Field>
          <Field label="Notes for the client" hint="Optional context shown above the caption.">
            <Textarea name="brief" rows={3} placeholder="e.g. Final festive post. Goes live 25 Oct, 6 PM." />
          </Field>
        </Card>
        <Card className="space-y-2 p-5">
          {requireInternalApproval ? (
            <>
              <Button type="submit" value="submit" className="w-full" disabled={!!pending || !assets.length}>
                {pending === "submit" ? "Submitting…" : "Submit for internal approval"}
              </Button>
              <p className="text-xs text-zinc-500">This project requires a teammate’s approval before anything goes to the client.</p>
            </>
          ) : (
            <Button type="submit" value="send" className="w-full" disabled={!!pending || !assets.length}>
              {pending === "send" ? "Saving…" : "Continue to send to client"}
            </Button>
          )}
          <Button type="submit" value="draft" variant="secondary" className="w-full" disabled={!!pending || !assets.length}>
            {pending === "draft" ? "Saving…" : "Save as draft"}
          </Button>
        </Card>
      </div>
    </form>
  );
}
