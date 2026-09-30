import { workspaceMembers } from "@/lib/queries";
import { requireWorkspace } from "@/lib/session";
import { ChatShell } from "./chat-shell";

export default async function ChatLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const members = await workspaceMembers(ctx.workspace.id);
  return (
    <ChatShell
      slug={slug}
      meId={ctx.user.id}
      members={members.filter((m) => m.userId !== ctx.user.id).map((m) => ({ id: m.userId, name: m.name, image: m.image, designation: m.designation }))}
    >
      {children}
    </ChatShell>
  );
}
