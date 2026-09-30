import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* -------------------------------------------------------------------------- */
/*                         Auth (managed by Better Auth)                       */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*                         Workspaces (agencies) & team                        */
/* -------------------------------------------------------------------------- */

export type WorkspaceRole = "owner" | "admin" | "member";

export const workspace = pgTable("workspace", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoKey: text("logo_key"),
  brandColor: text("brand_color").notNull().default("#4f46e5"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const membership = pgTable(
  "membership",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<WorkspaceRole>().notNull().default("member"),
    designation: text("designation"),
    phone: text("phone"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("membership_ws_user_uq").on(t.workspaceId, t.userId),
    index("membership_user_idx").on(t.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<WorkspaceRole>().notNull().default("member"),
    designation: text("designation"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("invitation_ws_idx").on(t.workspaceId)],
);

/* -------------------------------------------------------------------------- */
/*                         Clients, contacts & projects                        */
/* -------------------------------------------------------------------------- */

export const client = pgTable(
  "client",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    logoKey: text("logo_key"),
    industry: text("industry"),
    website: text("website"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    taxId: text("tax_id"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("client_ws_idx").on(t.workspaceId)],
);

export const clientContact = pgTable(
  "client_contact",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    /** E.164-ish, digits with leading country code, e.g. 919876543210. Used for WhatsApp. */
    phone: text("phone"),
    designation: text("designation"),
    isApprover: boolean("is_approver").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("contact_client_idx").on(t.clientId)],
);

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export const project = pgTable(
  "project",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").$type<ProjectStatus>().notNull().default("active"),
    /** When on, every version must be approved by a teammate before it can go to the client. */
    requireInternalApproval: boolean("require_internal_approval").notNull().default(true),
    startDate: timestamp("start_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("project_ws_idx").on(t.workspaceId), index("project_client_idx").on(t.clientId)],
);

export const projectMember = pgTable(
  "project_member",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

/* -------------------------------------------------------------------------- */
/*                               Approvals                                     */
/* -------------------------------------------------------------------------- */

export type ApprovalStatus =
  | "draft"
  | "internal_review"
  | "internal_changes"
  | "ready"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "cancelled";

export type Platform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "youtube"
  | "threads"
  | "pinterest"
  | "other";

export const approvalRequest = pgTable(
  "approval_request",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    brief: text("brief"),
    caption: text("caption"),
    platform: text("platform").$type<Platform>(),
    status: text("status").$type<ApprovalStatus>().notNull().default("draft"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    shareToken: text("share_token").notNull().unique(),
    linkEnabled: boolean("link_enabled").notNull().default(true),
    currentVersion: integer("current_version").notNull().default(1),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("request_ws_status_idx").on(t.workspaceId, t.status),
    index("request_project_idx").on(t.projectId),
  ],
);

/** Client contacts a request was sent to. `accessKey` powers the personal (identity-verified) link. */
export const approvalRecipient = pgTable(
  "approval_recipient",
  {
    id: id(),
    requestId: text("request_id")
      .notNull()
      .references(() => approvalRequest.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => clientContact.id, { onDelete: "cascade" }),
    accessKey: text("access_key").notNull().unique(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("recipient_req_contact_uq").on(t.requestId, t.contactId)],
);

export const version = pgTable(
  "version",
  {
    id: id(),
    requestId: text("request_id")
      .notNull()
      .references(() => approvalRequest.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    note: text("note"),
    caption: text("caption"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    internalApprovedBy: text("internal_approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    internalApprovedAt: timestamp("internal_approved_at", { withTimezone: true }),
    /** When this version was first shown to the client. Unsent versions are hidden from clients. */
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("version_req_number_uq").on(t.requestId, t.number)],
);

export const asset = pgTable(
  "asset",
  {
    id: id(),
    requestId: text("request_id")
      .notNull()
      .references(() => approvalRequest.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => version.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    thumbKey: text("thumb_key"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("asset_version_idx").on(t.versionId)],
);

/** A no-login client reviewer. One identity per (client, email) so it carries across requests. */
export const reviewer = pgTable(
  "reviewer",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => clientContact.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    /** Secret stored in the reviewer's cookie. */
    secret: text("secret").notNull().unique(),
    /** True when identity came from a personal link rather than being self-declared. */
    verified: boolean("verified").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("reviewer_client_idx").on(t.clientId)],
);

export type Annotation =
  | { type: "pin"; x: number; y: number }
  | { type: "box"; x: number; y: number; w: number; h: number };

export const comment = pgTable(
  "comment",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    requestId: text("request_id")
      .notNull()
      .references(() => approvalRequest.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => version.id, { onDelete: "cascade" }),
    assetId: text("asset_id").references(() => asset.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    authorUserId: text("author_user_id").references(() => user.id, { onDelete: "set null" }),
    authorReviewerId: text("author_reviewer_id").references(() => reviewer.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    visibility: text("visibility").$type<"shared" | "internal">().notNull().default("shared"),
    annotation: jsonb("annotation").$type<Annotation>(),
    /** Quoted caption text when the comment targets part of the caption. */
    captionQuote: text("caption_quote"),
    /** Where the comment came from. `whatsapp` is reserved for the upcoming WhatsApp automation. */
    source: text("source").$type<"web" | "email" | "whatsapp">().notNull().default("web"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("comment_request_idx").on(t.requestId), index("comment_parent_idx").on(t.parentId)],
);

export const decision = pgTable(
  "decision",
  {
    id: id(),
    requestId: text("request_id")
      .notNull()
      .references(() => approvalRequest.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => version.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"internal" | "client">().notNull(),
    outcome: text("outcome").$type<"approved" | "changes_requested">().notNull(),
    note: text("note"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    reviewerId: text("reviewer_id").references(() => reviewer.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    actorEmail: text("actor_email"),
    identityVerified: boolean("identity_verified").notNull().default(false),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("decision_request_idx").on(t.requestId)],
);

export const activity = pgTable(
  "activity",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    requestId: text("request_id").references(() => approvalRequest.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => client.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorReviewerId: text("actor_reviewer_id").references(() => reviewer.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_ws_idx").on(t.workspaceId, t.createdAt),
    index("activity_request_idx").on(t.requestId),
  ],
);

export const notification = pgTable(
  "notification",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/*                         Chat & project discussions                          */
/* -------------------------------------------------------------------------- */

export type ChannelKind = "public" | "private" | "dm" | "project";

export const channel = pgTable(
  "channel",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ChannelKind>().notNull(),
    name: text("name").notNull(),
    topic: text("topic"),
    projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),
    /** For DMs: sorted member ids joined with ":" so a conversation is never duplicated. */
    dmKey: text("dm_key"),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("channel_ws_idx").on(t.workspaceId),
    uniqueIndex("channel_dm_uq").on(t.workspaceId, t.dmKey),
    uniqueIndex("channel_project_uq").on(t.projectId),
  ],
);

export const channelMember = pgTable(
  "channel_member",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.userId] }), index("cm_user_idx").on(t.userId)],
);

export type Attachment = {
  key: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
};

export const message = pgTable(
  "message",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    parentId: text("parent_id"),
    body: text("body").notNull().default(""),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default(sql`'[]'::jsonb`),
    /** Optional link to an approval request, rendered as a card. */
    requestId: text("request_id").references(() => approvalRequest.id, { onDelete: "set null" }),
    /** System messages (e.g. "Client approved v2") have no user. */
    system: boolean("system").notNull().default(false),
    replyCount: integer("reply_count").notNull().default(0),
    lastReplyAt: timestamp("last_reply_at", { withTimezone: true }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("message_channel_idx").on(t.channelId, t.createdAt),
    index("message_parent_idx").on(t.parentId),
  ],
);

export const reaction = pgTable(
  "reaction",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })],
);

export type DecisionLogStatus = "proposed" | "decided" | "superseded";

/** Project decision log: what was decided, by whom, and why. */
export const decisionLog = pgTable(
  "decision_log",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    details: text("details"),
    status: text("status").$type<DecisionLogStatus>().notNull().default("decided"),
    source: text("source").$type<"manual" | "approval" | "chat">().notNull().default("manual"),
    requestId: text("request_id").references(() => approvalRequest.id, { onDelete: "set null" }),
    messageId: text("message_id").references(() => message.id, { onDelete: "set null" }),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("decision_log_project_idx").on(t.projectId, t.decidedAt)],
);

/* -------------------------------------------------------------------------- */
/*                                 Relations                                   */
/* -------------------------------------------------------------------------- */

export const membershipRelations = relations(membership, ({ one }) => ({
  user: one(user, { fields: [membership.userId], references: [user.id] }),
  workspace: one(workspace, { fields: [membership.workspaceId], references: [workspace.id] }),
}));

export const clientRelations = relations(client, ({ many }) => ({
  contacts: many(clientContact),
  projects: many(project),
}));

export const clientContactRelations = relations(clientContact, ({ one }) => ({
  client: one(client, { fields: [clientContact.clientId], references: [client.id] }),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  client: one(client, { fields: [project.clientId], references: [client.id] }),
  members: many(projectMember),
  requests: many(approvalRequest),
}));

export const projectMemberRelations = relations(projectMember, ({ one }) => ({
  project: one(project, { fields: [projectMember.projectId], references: [project.id] }),
  user: one(user, { fields: [projectMember.userId], references: [user.id] }),
}));

export const approvalRequestRelations = relations(approvalRequest, ({ one, many }) => ({
  project: one(project, { fields: [approvalRequest.projectId], references: [project.id] }),
  client: one(client, { fields: [approvalRequest.clientId], references: [client.id] }),
  creator: one(user, { fields: [approvalRequest.createdBy], references: [user.id] }),
  versions: many(version),
  assets: many(asset),
  recipients: many(approvalRecipient),
}));

export const approvalRecipientRelations = relations(approvalRecipient, ({ one }) => ({
  request: one(approvalRequest, {
    fields: [approvalRecipient.requestId],
    references: [approvalRequest.id],
  }),
  contact: one(clientContact, {
    fields: [approvalRecipient.contactId],
    references: [clientContact.id],
  }),
}));

export const versionRelations = relations(version, ({ one, many }) => ({
  request: one(approvalRequest, { fields: [version.requestId], references: [approvalRequest.id] }),
  assets: many(asset),
}));

export const assetRelations = relations(asset, ({ one }) => ({
  version: one(version, { fields: [asset.versionId], references: [version.id] }),
  request: one(approvalRequest, { fields: [asset.requestId], references: [approvalRequest.id] }),
}));
