"use client";

import { CheckCircle2, CircleDashed, History, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { DialogTrigger, SubmitButton } from "@/components/client-ui";
import { Avatar, Badge, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import {
  addProjectMembersAction,
  createProjectAction,
  deleteDecisionAction,
  deleteProjectAction,
  removeProjectMemberAction,
  saveDecisionAction,
  setDecisionStatusAction,
  toggleInternalApprovalAction,
  updateProjectAction,
} from "./actions";

type Member = { userId: string; name: string; image?: string | null; designation: string | null };

function dateValue(d: string | null | undefined) {
  return d ? d.slice(0, 10) : "";
}

function MemberPicker({ members, selected = [], exclude = [] }: { members: Member[]; selected?: string[]; exclude?: string[] }) {
  const list = members.filter((m) => !exclude.includes(m.userId));
  if (!list.length) return <p className="text-sm text-zinc-500">Everyone is already on this project.</p>;
  return (
    <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg p-1 ring-1 ring-zinc-200">
      {list.map((m) => (
        <label key={m.userId} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50">
          <input type="checkbox" name="members" value={m.userId} defaultChecked={selected.includes(m.userId)} className="h-4 w-4 accent-brand-600" />
          <Avatar name={m.name} src={m.image} size={24} />
          <span className="text-sm">
            {m.name} {m.designation ? <span className="text-zinc-500">· {m.designation}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function NewProjectButton({
  slug,
  clients,
  members,
  defaultClientId,
  meId,
  variant,
}: {
  slug: string;
  clients: { id: string; name: string }[];
  members: Member[];
  defaultClientId?: string;
  meId: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <DialogTrigger
      variant={variant}
      label={
        <>
          <Plus className="h-4 w-4" /> New project
        </>
      }
      title="New project"
      description="A campaign, retainer month, or any body of work for a client."
    >
      {() =>
        clients.length === 0 ? (
          <p className="text-sm text-zinc-500">Add a client first. Projects belong to a client.</p>
        ) : (
          <ActionForm action={createProjectAction.bind(null, slug)}>
            <Field label="Client">
              <Select name="clientId" defaultValue={defaultClientId ?? clients[0]?.id} required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Project name">
              <Input name="name" required placeholder="e.g. Diwali Campaign 2026 or October Retainer" />
            </Field>
            <Field label="Description">
              <Textarea name="description" rows={2} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <Input type="date" name="startDate" />
              </Field>
              <Field label="Due date">
                <Input type="date" name="dueDate" />
              </Field>
            </div>
            <Checkbox
              name="requireInternalApproval"
              defaultChecked
              label="Require internal approval before sending to the client"
              hint="A teammate must approve each version first. You can switch this off anytime."
            />
            <Field label="Assign teammates" hint="You’re added automatically. Only assigned people (and admins) can request approvals.">
              <MemberPicker members={members} exclude={[meId]} />
            </Field>
            <div className="flex justify-end">
              <SubmitButton pendingText="Creating…">Create project</SubmitButton>
            </div>
          </ActionForm>
        )
      }
    </DialogTrigger>
  );
}

export function InternalApprovalToggle({ slug, projectId, value, canEdit }: { slug: string; projectId: string; value: boolean; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(value);
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <ShieldCheck className={cn("mt-0.5 h-5 w-5 shrink-0", on ? "text-violet-600" : "text-zinc-400")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Internal approval {on ? "is on" : "is off"}</p>
        <p className="text-sm text-zinc-500">
          {on
            ? "Each version must be approved by a teammate (or admin) before it can be sent to the client."
            : "Versions can be sent straight to the client."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={!canEdit || pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          start(async () => {
            await toggleInternalApprovalAction(slug, projectId, next);
          });
        }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          on ? "bg-violet-600" : "bg-zinc-300",
        )}
      >
        <span className={cn("inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition", on ? "translate-x-5.5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

export function ProjectSettingsForm({
  slug,
  project,
  isAdmin,
}: {
  slug: string;
  project: { id: string; name: string; description: string | null; status: string; startDate: string | null; dueDate: string | null; requireInternalApproval: boolean };
  isAdmin: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-8">
      <ActionForm action={updateProjectAction.bind(null, slug, project.id)}>
        <Field label="Project name">
          <Input name="name" defaultValue={project.name} required />
        </Field>
        <Field label="Description">
          <Textarea name="description" defaultValue={project.description ?? ""} rows={3} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Status">
            <Select name="status" defaultValue={project.status}>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Start date">
            <Input type="date" name="startDate" defaultValue={dateValue(project.startDate)} />
          </Field>
          <Field label="Due date">
            <Input type="date" name="dueDate" defaultValue={dateValue(project.dueDate)} />
          </Field>
        </div>
        <Checkbox
          name="requireInternalApproval"
          defaultChecked={project.requireInternalApproval}
          label="Require internal approval before sending to the client"
        />
        <div className="flex justify-end">
          <SubmitButton>Save project</SubmitButton>
        </div>
      </ActionForm>
      {isAdmin ? (
        <div className="flex items-center justify-between gap-3 rounded-xl p-4 ring-1 ring-rose-200">
          <div>
            <p className="text-sm font-medium">Delete project</p>
            <p className="text-sm text-zinc-500">Removes all approvals, comments, discussion and decisions in it.</p>
          </div>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => confirm("Delete this project permanently?") && start(async () => void (await deleteProjectAction(slug, project.id)))}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectMembers({
  slug,
  projectId,
  members,
  allMembers,
  canEdit,
}: {
  slug: string;
  projectId: string;
  members: Member[];
  allMembers: Member[];
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div>
      {canEdit ? (
        <div className="mb-4 flex justify-end">
          <DialogTrigger
            label={
              <>
                <Plus className="h-4 w-4" /> Add people
              </>
            }
            title="Add teammates to project"
          >
            {(close) => (
              <ActionForm action={addProjectMembersAction.bind(null, slug, projectId)} onSuccess={close}>
                <MemberPicker members={allMembers} exclude={members.map((m) => m.userId)} />
                <div className="flex justify-end">
                  <SubmitButton>Add</SubmitButton>
                </div>
              </ActionForm>
            )}
          </DialogTrigger>
        </div>
      ) : null}
      <div className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
        {members.length === 0 ? <p className="p-6 text-center text-sm text-zinc-500">No one is assigned yet.</p> : null}
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 p-3">
            <Avatar name={m.name} src={m.image} size={32} />
            <div className="flex-1">
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-xs text-zinc-500">{m.designation ?? "Team member"}</div>
            </div>
            {canEdit ? (
              <button
                disabled={pending}
                onClick={() => start(() => removeProjectMemberAction(slug, projectId, m.userId))}
                className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                title="Remove from project"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

type Decision = {
  id: string;
  title: string;
  details: string | null;
  status: "proposed" | "decided" | "superseded";
  source: string;
  decidedBy: string | null;
  decidedAt: string;
  requestId: string | null;
  requestTitle: string | null;
};

const statusStyle = {
  proposed: { label: "Proposed", cls: "bg-amber-50 text-amber-800 ring-amber-200", icon: CircleDashed },
  decided: { label: "Decided", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  superseded: { label: "Superseded", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200", icon: History },
};

function DecisionFields({ d }: { d?: Decision }) {
  return (
    <>
      <Field label="Decision">
        <Input name="title" required defaultValue={d?.title} placeholder="e.g. Use the teal palette for all festive posts" />
      </Field>
      <Field label="Context / reasoning">
        <Textarea name="details" rows={3} defaultValue={d?.details ?? ""} placeholder="Why, alternatives considered, links…" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Status">
          <Select name="status" defaultValue={d?.status ?? "decided"}>
            <option value="decided">Decided</option>
            <option value="proposed">Proposed</option>
            <option value="superseded">Superseded</option>
          </Select>
        </Field>
        <Field label="Decided by">
          <Input name="decidedBy" defaultValue={d?.decidedBy ?? ""} placeholder="You, or client name" />
        </Field>
        <Field label="Date">
          <Input name="decidedAt" type="date" defaultValue={dateValue(d?.decidedAt)} />
        </Field>
      </div>
    </>
  );
}

export function DecisionLog({ slug, projectId, decisions }: { slug: string; projectId: string; decisions: Decision[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Decision["status"]>("all");
  const [pending, start] = useTransition();
  const shown = decisions.filter((d) => filter === "all" || d.status === filter);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
          {(["all", "decided", "proposed", "superseded"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("rounded-md px-3 py-1 capitalize", filter === f ? "bg-white font-medium shadow-sm" : "text-zinc-600")}
            >
              {f}
            </button>
          ))}
        </div>
        <DialogTrigger
          label={
            <>
              <Plus className="h-4 w-4" /> Log decision
            </>
          }
          title="Log a decision"
          description="Keep a record of what was agreed, so nobody has to dig through chats later."
        >
          {(close) => (
            <ActionForm action={saveDecisionAction.bind(null, slug, projectId, null)} onSuccess={close}>
              <DecisionFields />
              <div className="flex justify-end">
                <SubmitButton>Save decision</SubmitButton>
              </div>
            </ActionForm>
          )}
        </DialogTrigger>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl bg-white p-10 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          No decisions logged yet. Client approvals are added here automatically, and you can log decisions from chat messages too.
        </p>
      ) : (
        <ol className="relative space-y-4 border-l border-zinc-200 pl-6">
          {shown.map((d) => {
            const s = statusStyle[d.status];
            return (
              <li key={d.id} className="relative">
                <span className="absolute top-4 -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-zinc-200">
                  <span className={cn("h-2 w-2 rounded-full", d.status === "decided" ? "bg-emerald-500" : d.status === "proposed" ? "bg-amber-500" : "bg-zinc-400")} />
                </span>
                <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
                  {editing === d.id ? (
                    <ActionForm action={saveDecisionAction.bind(null, slug, projectId, d.id)} onSuccess={() => setEditing(null)}>
                      <DecisionFields d={d} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <SubmitButton>Save</SubmitButton>
                      </div>
                    </ActionForm>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className={cn("font-medium", d.status === "superseded" && "text-zinc-500 line-through")}>{d.title}</h3>
                        <div className="flex items-center gap-1">
                          <Badge className={s.cls}>
                            <s.icon className="h-3 w-3" /> {s.label}
                          </Badge>
                          {d.source !== "manual" ? <Badge>{d.source === "approval" ? "From approval" : "From chat"}</Badge> : null}
                        </div>
                      </div>
                      {d.details ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{d.details}</p> : null}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                        <span>
                          {d.decidedBy ? `${d.decidedBy} · ` : ""}
                          {formatDate(d.decidedAt)}
                          {d.requestId ? (
                            <>
                              {" · "}
                              <a className="text-brand-600 hover:underline" href={`/w/${slug}/approvals/${d.requestId}`}>
                                {d.requestTitle ?? "View approval"}
                              </a>
                            </>
                          ) : null}
                        </span>
                        <span className="flex gap-1">
                          {d.status !== "decided" ? (
                            <button className="rounded px-2 py-1 hover:bg-zinc-100" disabled={pending} onClick={() => start(() => setDecisionStatusAction(slug, projectId, d.id, "decided"))}>
                              Mark decided
                            </button>
                          ) : (
                            <button className="rounded px-2 py-1 hover:bg-zinc-100" disabled={pending} onClick={() => start(() => setDecisionStatusAction(slug, projectId, d.id, "superseded"))}>
                              Supersede
                            </button>
                          )}
                          <button className="rounded p-1 hover:bg-zinc-100" onClick={() => setEditing(d.id)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="rounded p-1 hover:bg-rose-50 hover:text-rose-600"
                            disabled={pending}
                            onClick={() => confirm("Delete this decision?") && start(() => deleteDecisionAction(slug, projectId, d.id))}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
