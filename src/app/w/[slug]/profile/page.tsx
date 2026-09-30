import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireWorkspace } from "@/lib/session";
import { ChangePasswordForm, ProfileForm } from "./profile-forms";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Your profile" />
      <Card>
        <CardHeader title="Profile" description="How teammates and clients see you." />
        <div className="p-5">
          <ProfileForm
            slug={slug}
            me={{
              name: ctx.user.name,
              email: ctx.user.email,
              image: ctx.user.image ?? null,
              designation: ctx.membership.designation,
              phone: ctx.membership.phone,
              workspace: ctx.workspace.name,
            }}
          />
        </div>
      </Card>
      <Card>
        <CardHeader title="Password" />
        <div className="p-5">
          <ChangePasswordForm />
        </div>
      </Card>
    </div>
  );
}
