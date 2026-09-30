"use client";

import { ChannelView } from "@/components/chat/channel-view";
import type { MentionMember } from "@/components/mention-textarea";
import { CHAT_CHANGED } from "../chat-shell";

export function ChannelClient(props: { slug: string; channelId: string; me: { id: string; name: string }; members: MentionMember[] }) {
  return (
    <ChannelView
      {...props}
      backHref={`/w/${props.slug}/chat`}
      onChanged={() => window.dispatchEvent(new Event(CHAT_CHANGED))}
    />
  );
}
