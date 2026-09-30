import { requireWorkspace } from "@/lib/session";
import { fileUrl } from "@/lib/utils";
import { userWorkspaces } from "@/lib/workspaces";
import { Shell } from "./shell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const workspaces = await userWorkspaces(ctx.user.id);
  return (
    <Shell
      workspace={{
        name: ctx.workspace.name,
        slug: ctx.workspace.slug,
        logoUrl: fileUrl(ctx.workspace.logoKey),
      }}
      workspaces={workspaces.map((w) => ({ name: w.name, slug: w.slug, logoUrl: fileUrl(w.logoKey) }))}
      user={{ name: ctx.user.name, email: ctx.user.email, image: ctx.user.image ?? null }}
      role={ctx.role}
    >
      {children}
    </Shell>
  );
}
