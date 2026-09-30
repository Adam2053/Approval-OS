"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client-ui";
import { Avatar, Checkbox, Field, Input, Select } from "@/components/ui";
import { deleteWorkspaceAction, updateWorkspaceAction } from "./actions";

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

export function WorkspaceSettingsForm({
  slug,
  ws,
  isOwner,
}: {
  slug: string;
  ws: { name: string; brandColor: string; timezone: string; logoUrl: string | null };
  isOwner: boolean;
}) {
  const [color, setColor] = useState(ws.brandColor);
  const zones = TIMEZONES.includes(ws.timezone) ? TIMEZONES : [ws.timezone, ...TIMEZONES];
  return (
    <div className="space-y-8">
      <ActionForm action={updateWorkspaceAction.bind(null, slug)}>
        <Field label="Workspace name" hint="Clients see this on review links and emails.">
          <Input name="name" defaultValue={ws.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Logo" hint="Shown on client review pages.">
            <div className="flex items-center gap-3">
              <Avatar name={ws.name} src={ws.logoUrl} size={40} square />
              <Input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-1.5" />
            </div>
          </Field>
          <Field label="Brand color" hint="Used for buttons on the client review page.">
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-zinc-300" />
              <Input name="brandColor" value={color} onChange={(e) => setColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" />
            </div>
          </Field>
        </div>
        {ws.logoUrl ? <Checkbox name="removeLogo" label="Remove current logo" /> : null}
        <Field label="Time zone" hint="Used for due dates and reminders.">
          <Select name="timezone" defaultValue={ws.timezone}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </ActionForm>

      {isOwner ? (
        <div className="rounded-xl p-5 ring-1 ring-rose-200">
          <h3 className="font-medium text-rose-700">Delete workspace</h3>
          <p className="mt-1 text-sm text-zinc-500">Permanently deletes all clients, projects, approvals, chat and history.</p>
          <ActionForm action={deleteWorkspaceAction.bind(null, slug)} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input name="confirm" placeholder={`Type "${ws.name}" to confirm`} />
            <SubmitButton variant="danger" pendingText="Deleting…">
              Delete workspace
            </SubmitButton>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
