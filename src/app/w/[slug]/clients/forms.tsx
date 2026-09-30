"use client";

import { Mail, MessageCircle, Pencil, Phone, Plus, Trash2, UserCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { DialogTrigger, SubmitButton } from "@/components/client-ui";
import { Avatar, Badge, Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { formatPhone } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { createClientAction, deleteClientAction, deleteContactAction, saveContactAction, setClientArchivedAction, updateClientAction } from "./actions";

type ClientData = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  logoUrl: string | null;
  archivedAt: string | null;
};

function ClientFields({ c }: { c?: ClientData }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" className="sm:col-span-2">
          <Input name="name" required defaultValue={c?.name} placeholder="e.g. Chai Point Cafe" />
        </Field>
        <Field label="Industry">
          <Input name="industry" defaultValue={c?.industry ?? ""} placeholder="Food & Beverage" />
        </Field>
        <Field label="Website">
          <Input name="website" defaultValue={c?.website ?? ""} placeholder="https://" />
        </Field>
        <Field label="Company email">
          <Input name="email" type="email" defaultValue={c?.email ?? ""} />
        </Field>
        <Field label="Company phone">
          <Input name="phone" defaultValue={c?.phone ? formatPhone(c.phone) : ""} placeholder="+91 98765 43210" />
        </Field>
        <Field label="GST / Tax ID">
          <Input name="taxId" defaultValue={c?.taxId ?? ""} />
        </Field>
        <Field label="Logo" hint="PNG/JPG, square works best.">
          <Input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-1.5" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input name="address" defaultValue={c?.address ?? ""} />
        </Field>
        <Field label="Notes" className="sm:col-span-2" hint="Internal only. Brand guidelines, preferences, anything useful.">
          <Textarea name="notes" defaultValue={c?.notes ?? ""} rows={3} />
        </Field>
      </div>
    </>
  );
}

export function NewClientButton({ slug }: { slug: string }) {
  return (
    <DialogTrigger
      label={
        <>
          <Plus className="h-4 w-4" /> New client
        </>
      }
      title="Add a client"
      description="Clients hold contacts and projects."
    >
      {() => (
        <ActionForm action={createClientAction.bind(null, slug)}>
          <ClientFields />
          <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
            <p className="mb-3 text-sm font-medium">Primary contact (approver)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="contactName" placeholder="Name" />
              <Input name="contactDesignation" placeholder="Designation, e.g. Marketing Head" />
              <Input name="contactEmail" type="email" placeholder="Email" />
              <Input name="contactPhone" placeholder="WhatsApp number, e.g. +91 98765 43210" />
            </div>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingText="Creating…">Create client</SubmitButton>
          </div>
        </ActionForm>
      )}
    </DialogTrigger>
  );
}

export function EditClientForm({ slug, c, isAdmin }: { slug: string; c: ClientData; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-8">
      <ActionForm action={updateClientAction.bind(null, slug, c.id)}>
        <ClientFields c={c} />
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ring-1 ring-rose-200">
        <div>
          <p className="text-sm font-medium">{c.archivedAt ? "Client is archived" : "Archive client"}</p>
          <p className="text-sm text-zinc-500">Archived clients are hidden from lists but nothing is deleted.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => start(() => setClientArchivedAction(slug, c.id, !c.archivedAt))}>
            {c.archivedAt ? "Unarchive" : "Archive"}
          </Button>
          {isAdmin ? (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete ${c.name} and ALL its projects, approvals and history? This cannot be undone.`))
                  start(async () => {
                    await deleteClientAction(slug, c.id);
                  });
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  isApprover: boolean;
};

function ContactFields({ c }: { c?: Contact }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <Input name="name" required defaultValue={c?.name} />
      </Field>
      <Field label="Designation">
        <Input name="designation" defaultValue={c?.designation ?? ""} placeholder="Brand Manager" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={c?.email ?? ""} />
      </Field>
      <Field label="Phone / WhatsApp" hint="Include country code.">
        <Input name="phone" defaultValue={c?.phone ? formatPhone(c.phone) : ""} placeholder="+91 98765 43210" />
      </Field>
      <div className="sm:col-span-2">
        <Checkbox
          name="isApprover"
          defaultChecked={c ? c.isApprover : true}
          label="Can approve"
          hint="Approvers can give the final approval. Anyone else with the link can only comment."
        />
      </div>
    </div>
  );
}

export function ContactsManager({ slug, clientId, contacts }: { slug: string; clientId: string; contacts: Contact[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <DialogTrigger
          label={
            <>
              <Plus className="h-4 w-4" /> Add contact
            </>
          }
          title="Add contact"
        >
          {(close) => (
            <ActionForm action={saveContactAction.bind(null, slug, clientId, null)} onSuccess={close}>
              <ContactFields />
              <div className="flex justify-end">
                <SubmitButton>Add contact</SubmitButton>
              </div>
            </ActionForm>
          )}
        </DialogTrigger>
      </div>
      {contacts.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          No contacts yet. Add the people who review and approve your work.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
          {contacts.map((c) =>
            editing === c.id ? (
              <div key={c.id} className="p-4">
                <ActionForm action={saveContactAction.bind(null, slug, clientId, c.id)} onSuccess={() => setEditing(null)}>
                  <ContactFields c={c} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <SubmitButton>Save</SubmitButton>
                  </div>
                </ActionForm>
              </div>
            ) : (
              <div key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={c.name} size={36} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.isApprover ? (
                        <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                          <UserCheck className="h-3 w-3" /> Approver
                        </Badge>
                      ) : (
                        <Badge>Commenter</Badge>
                      )}
                    </div>
                    <div className="truncate text-sm text-zinc-500">
                      {[c.designation, c.email, c.phone ? formatPhone(c.phone) : null].filter(Boolean).join(" · ") || "No contact details"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {c.phone ? (
                    <a href={waLink(c.phone, "")} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50" title="WhatsApp">
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a href={`tel:+${c.phone}`} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" title="Call">
                      <Phone className="h-4 w-4" />
                    </a>
                  ) : null}
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" title="Email">
                      <Mail className="h-4 w-4" />
                    </a>
                  ) : null}
                  <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" onClick={() => setEditing(c.id)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                    disabled={pending}
                    onClick={() => confirm(`Remove ${c.name}?`) && start(() => deleteContactAction(slug, clientId, c.id))}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
