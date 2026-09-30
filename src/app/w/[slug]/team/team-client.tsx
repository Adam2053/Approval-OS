"use client";

import { Clock, MessageCircle, Pencil, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { CopyButton, DialogTrigger, SubmitButton } from "@/components/client-ui";
import { Avatar, Badge, Button, Field, Input, Select } from "@/components/ui";
import { formatDate, formatPhone } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { inviteMemberAction, removeMemberAction, revokeInviteAction, updateMemberAction } from "./actions";

type Member = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: "owner" | "admin" | "member";
  designation: string | null;
  phone: string | null;
  joinedAt: string;
};

type Invite = { id: string; email: string; role: string; designation: string | null; url: string; expiresAt: string };

const roleTone = {
  owner: "bg-brand-50 text-brand-700 ring-brand-200",
  admin: "bg-sky-50 text-sky-700 ring-sky-200",
  member: "",
};

export function InviteButton({ slug, workspaceName }: { slug: string; workspaceName: string }) {
  return (
    <DialogTrigger
      label={
        <>
          <UserPlus className="h-4 w-4" /> Invite teammate
        </>
      }
      title={`Invite to ${workspaceName}`}
      description="They’ll get an email with a link to join. You can also share the link on WhatsApp."
    >
      {() => (
        <ActionForm action={inviteMemberAction.bind(null, slug)} resetOnSuccess>
          <Field label="Email">
            <Input name="email" type="email" required placeholder="teammate@agency.com" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Designation">
              <Input name="designation" placeholder="Graphic Designer" />
            </Field>
            <Field label="Role" hint="Admins manage team, clients and settings.">
              <Select name="role" defaultValue="member">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingText="Sending…">Send invite</SubmitButton>
          </div>
        </ActionForm>
      )}
    </DialogTrigger>
  );
}

export function MembersTable({ slug, members, meId, myRole }: { slug: string; members: Member[]; meId: string; myRole: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const isAdmin = myRole === "owner" || myRole === "admin";
  return (
    <div className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
      {members.map((m) => {
        const canEdit = isAdmin || m.userId === meId;
        if (editing === m.membershipId)
          return (
            <div key={m.membershipId} className="p-4">
              <ActionForm action={updateMemberAction.bind(null, slug, m.membershipId)} onSuccess={() => setEditing(null)}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Designation">
                    <Input name="designation" defaultValue={m.designation ?? ""} />
                  </Field>
                  <Field label="Phone / WhatsApp">
                    <Input name="phone" defaultValue={m.phone ? formatPhone(m.phone) : ""} placeholder="+91…" />
                  </Field>
                  <Field label="Role">
                    <Select name="role" defaultValue={m.role} disabled={!isAdmin}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      {myRole === "owner" || m.role === "owner" ? <option value="owner">Owner</option> : null}
                    </Select>
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <SubmitButton>Save</SubmitButton>
                </div>
              </ActionForm>
            </div>
          );
        return (
          <div key={m.membershipId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={m.name} src={m.image} size={40} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  {m.userId === meId ? <span className="text-xs text-zinc-400">(you)</span> : null}
                  <Badge className={roleTone[m.role]}>{m.role}</Badge>
                </div>
                <div className="truncate text-sm text-zinc-500">
                  {m.designation ?? "No designation"} · {m.email}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <span className="mr-2 hidden md:inline">Joined {formatDate(m.joinedAt)}</span>
              {m.phone ? (
                <a href={waLink(m.phone, "")} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50" title="WhatsApp">
                  <MessageCircle className="h-4 w-4" />
                </a>
              ) : null}
              {canEdit ? (
                <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" onClick={() => setEditing(m.membershipId)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
              {canEdit ? (
                <button
                  className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  disabled={pending}
                  title={m.userId === meId ? "Leave workspace" : "Remove"}
                  onClick={() => {
                    if (!confirm(m.userId === meId ? "Leave this workspace?" : `Remove ${m.name} from the workspace?`)) return;
                    start(async () => {
                      const r = await removeMemberAction(slug, m.membershipId);
                      if (r?.error) alert(r.error);
                      else if (m.userId === meId) router.push("/app");
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PendingInvites({ slug, invites, workspaceName }: { slug: string; invites: Invite[]; workspaceName: string }) {
  const [pending, start] = useTransition();
  if (!invites.length) return null;
  return (
    <div className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
      {invites.map((i) => (
        <div key={i.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <Clock className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{i.email}</div>
              <div className="text-sm text-zinc-500">
                {i.designation ?? i.role} · expires {formatDate(i.expiresAt)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={i.url} label="Copy link" />
            <a
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
              href={waLink(null, `Join ${workspaceName} on Approval OS: ${i.url}`)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => revokeInviteAction(slug, i.id))}>
              Revoke
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
