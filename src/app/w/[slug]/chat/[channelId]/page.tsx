import { notFound } from "next/navigation";
import { HttpError } from "@/lib/api";
import { channelAccess } from "@/lib/chat";
import { workspaceMembers } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { ChannelClient } from "./channel-client";

export default async function ChannelPage({ params }: { params: Promise<{ slug: string; channelId: string }> }) {
  const { slug, channelId } = await params;
  const ctx = await requireWorkspace(slug);
  try {
    await channelAccess(ctx, channelId);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const members = await workspaceMembers(ctx.workspace.id);
  return (
    <ChannelClient
      key={channelId}
      slug={slug}
      channelId={channelId}
      me={{ id: ctx.user.id, name: ctx.user.name }}
      members={members.map((m) => ({ id: m.userId, name: m.name, image: m.image, designation: m.designation }))}
    />
  );
}
