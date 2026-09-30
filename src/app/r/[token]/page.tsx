import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { buildReviewPayload } from "@/lib/approvals";
import { currentReviewer, requestByToken } from "@/lib/reviewer";
import { ClientReview } from "./client-review";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const req = await requestByToken(token);
  return {
    title: req ? `Review: ${req.title}` : "Review link",
    robots: { index: false, follow: false },
  };
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { token } = await params;
  const { k } = await searchParams;
  const req = await requestByToken(token);
  if (!req)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 text-center">
        <Logo className="mb-8" />
        <div className="max-w-sm rounded-2xl bg-white p-8 ring-1 ring-zinc-200">
          <LinkIcon className="mx-auto h-8 w-8 text-zinc-300" />
          <h1 className="mt-4 text-lg font-semibold">This review link isn’t active</h1>
          <p className="mt-2 text-sm text-zinc-500">The agency may have replaced or disabled it. Please ask them for the latest link.</p>
        </div>
      </div>
    );
  const rv = await currentReviewer(req);
  const payload = await buildReviewPayload(req, { kind: "client", reviewer: rv });
  if (payload.versions.length === 0)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 text-center">
        <div className="max-w-sm rounded-2xl bg-white p-8 ring-1 ring-zinc-200">
          <h1 className="text-lg font-semibold">Almost ready</h1>
          <p className="mt-2 text-sm text-zinc-500">{payload.workspace.name} is still preparing this for you. Please check back soon.</p>
        </div>
      </div>
    );
  return <ClientReview token={token} initial={JSON.parse(JSON.stringify(payload))} accessKey={k ?? null} />;
}
