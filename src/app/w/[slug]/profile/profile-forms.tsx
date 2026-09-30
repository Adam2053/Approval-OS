"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client-ui";
import { Avatar, Button, Field, FormError, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { formatPhone } from "@/lib/utils";
import { updateProfileAction } from "./actions";

export function ProfileForm({
  slug,
  me,
}: {
  slug: string;
  me: { name: string; email: string; image: string | null; designation: string | null; phone: string | null; workspace: string };
}) {
  return (
    <ActionForm action={updateProfileAction.bind(null, slug)}>
      <div className="flex items-center gap-4">
        <Avatar name={me.name} src={me.image} size={56} />
        <Field label="Photo" className="flex-1">
          <Input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-1.5" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input name="name" defaultValue={me.name} required />
        </Field>
        <Field label="Email">
          <Input value={me.email} disabled readOnly />
        </Field>
        <Field label={`Designation at ${me.workspace}`}>
          <Input name="designation" defaultValue={me.designation ?? ""} />
        </Field>
        <Field label="Phone / WhatsApp">
          <Input name="phone" defaultValue={me.phone ? formatPhone(me.phone) : ""} />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setPending(true);
        setError(null);
        const { error } = await authClient.changePassword({
          currentPassword: String(fd.get("current")),
          newPassword: String(fd.get("next")),
          revokeOtherSessions: true,
        });
        setPending(false);
        if (error) return setError(error.message ?? "Could not change password");
        setDone(true);
        form.reset();
      }}
    >
      <FormError message={error} />
      {done ? <p className="text-sm text-emerald-700">Password changed.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current password">
          <Input name="current" type="password" required />
        </Field>
        <Field label="New password">
          <Input name="next" type="password" minLength={8} required />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
