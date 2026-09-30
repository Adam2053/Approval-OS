import { Card, PageHeader } from "@/components/ui";
import { requireWorkspace } from "@/lib/session";
import { fileUrl } from "@/lib/utils";
import { WorkspaceSettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  if (!ctx.isAdmin)
    return (
      <>
        <PageHeader title="Settings" />
        <Card className="p-6 text-sm text-zinc-500">Only owners and admins can change workspace settings.</Card>
      </>
    );
  return (
    <>
      <PageHeader title="Workspace settings" description="Branding shown to your clients, and workspace preferences." />
      <Card className="p-5">
        <WorkspaceSettingsForm
          slug={slug}
          isOwner={ctx.role === "owner"}
          ws={{
            name: ctx.workspace.name,
            brandColor: ctx.workspace.brandColor,
            timezone: ctx.workspace.timezone,
            logoUrl: fileUrl(ctx.workspace.logoKey),
          }}
        />
      </Card>
    </>
  );
}
