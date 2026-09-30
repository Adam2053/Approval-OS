"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/client-ui";
import { Field, FormError, Input } from "@/components/ui";
import { createWorkspaceAction } from "./actions";

export function CreateWorkspaceForm() {
  const [state, action] = useActionState((prev: unknown, fd: FormData) => {
    // Capture the browser's time zone for due dates and reminders.
    try {
      fd.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
    } catch {}
    return createWorkspaceAction(prev, fd);
  }, null);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <Field label="Agency / company name" htmlFor="name">
        <Input id="name" name="name" placeholder="e.g. Pixel & Post Media" required autoFocus />
      </Field>
      <Field label="Your designation" hint="Shown next to your name for teammates and clients." htmlFor="designation">
        <Input id="designation" name="designation" placeholder="Founder, Account Manager, Designer…" />
      </Field>
      <SubmitButton className="w-full" pendingText="Creating…">
        Create workspace
      </SubmitButton>
    </form>
  );
}
