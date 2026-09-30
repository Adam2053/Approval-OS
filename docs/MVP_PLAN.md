# Approval OS — MVP Plan

> Status: **DRAFT, waiting on decisions.** No code gets written until the Decision Register (section 8) is filled in.
> Every decision below has a recommendation, but none of them is final until you mark it.

---

## 1. One-line pitch

**Approval OS lets agencies get client sign-off in one link.** The agency uploads the creative, sends a link, and the client opens it (no login), drops pins on the image, comments, and hits **Approve** or **Request changes**. Every round is versioned, and every approval is recorded with who approved it and when.

First target user: **social media agencies**, since they send the most approvals per week (daily posts, carousels, stories, ad creatives).

---

## 2. Research: where the gap is

I sorted the existing tools into three groups:

| Category | Examples | What they're good at | Why a small social agency still struggles |
|---|---|---|---|
| **Heavy creative proofing** | Filestage, Ziflow, PageProof, ReviewStudio, Approval Studio | Multi-stage workflows, video/PDF proofing, enterprise compliance | Expensive and complex, priced per seat, built for brand/marketing teams more than for small agencies managing 10–40 clients |
| **Social media schedulers with approvals** | Planable, Kontentino, SocialPilot, Ordinal | Feed previews, scheduling, approval steps | Approval is a feature bolted onto a scheduler. Pricing is per workspace/brand (e.g. Planable ~$33–49/mo per workspace), so the cost grows with every client |
| **Lightweight markup tools** | Markup.io, Pastel, GoVisually, BugHerd | Fast pin-and-comment | No agency structure (clients → projects), weak approval trail, and Pastel is website-focused |

**Where Approval OS fits:** a product that is *agency-shaped*:

1. **Built around the agency's structure.** Workspace → Clients → Projects → Approvals, plus client contacts and a team with designations. Most proofing tools are organized around files, not clients.
2. **The client never has to sign up.** Opening a link on a phone (usually from WhatsApp or email) has to just work.
3. **The approval log is the product.** You get timestamped records of "who approved what version when", which settles "we never approved that" disputes.
4. **Pricing that doesn't punish the agency for having many clients** (a later decision, but it shapes the data model now).

The biggest risk is that the market is crowded, so the MVP has to win on **speed and simplicity of the client experience**, not on feature count.

---

## 3. Recommended MVP scope

### IN (the smallest product that delivers the core loop)

1. **Team side (agency)**
   - Sign up / log in (email + Google)
   - Create a **Workspace** (= the agency / "company"). One user can belong to many.
   - Invite team members by email, with a **role** (permissions) and a **designation** (free text, e.g. "Graphic Designer", "Account Manager")
   - **Clients**: CRUD, logo, basic info, notes
   - **Client contacts**: name, email, phone, designation, "is approver" flag
   - **Projects** under a client: name, description, status, dates, assigned team members
2. **Approval requests** (the core)
   - Create a request inside a project: title, **caption/copy text**, one or more **images** (carousel), due date
   - Generate a **share link** and copy it, email it to selected client contacts, or send it via a "Share on WhatsApp" deep link
   - **Versions**: upload v2, v3… on the *same* link. The client always sees the latest version, and older versions stay viewable.
3. **Client review page** (the most important screen, built mobile-first)
   - No login. On first visit it asks for name + email (prefilled if the link was sent to a known contact).
   - View images (swipe on mobile), read the caption
   - **Annotate**: tap/click to drop a **pin** with a comment, or drag a **box** around an area
   - General comments on the whole request (and on the caption)
   - **Approve** or **Request changes** (with a note)
   - The request locks after approval (read-only, shows "Approved by X on DATE, v3")
4. **Collaboration on a request**
   - Threaded replies on each pin/comment
   - **Internal comments** (team-only, hidden from the client)
   - @mention teammates
   - Resolve / unresolve comments
5. **Notifications**
   - Email (client commented, approved, requested changes; teammate mentioned you; new version posted)
   - In-app notification bell
6. **Dashboards**
   - Workspace home: "Waiting on client", "Changes requested", "Approved this week", "Overdue"
   - Per-client and per-project lists of requests with statuses
7. **Activity log / approval trail** per request (created, sent, viewed, commented, approved, with IP and timestamp)

### OUT (explicitly deferred, so we don't build them yet)

- Video, PDF, GIF, and live-website review → v2
- Social feed mockup previews (Instagram/LinkedIn frame) → v1.1 (cheap, high wow factor, but not core)
- Scheduling or publishing to social networks → never, or much later (a different product)
- A general team chat like Slack (we do contextual comments instead, see decision D11)
- Multi-step approval chains (internal approval → client approval) → v1.1
- Client portal (one link showing all of a client's pending approvals) → v1.1 (see D8)
- Billing/subscriptions → after beta
- Custom domains / full white-label → v2
- Mobile native apps → never for MVP (a responsive web app is enough)
- Realtime live cursors / websockets → v2 (poll or refresh for now)

---

## 4. Domain model (proposed)

```
User ─┬─< Membership >── Workspace (agency / "company")
      │     role: owner | admin | member
      │     designation: "Graphic Designer" (free text)
      │
Workspace ──< Client ──< ClientContact (name, email, phone, designation, isApprover)
                  │
                  └──< Project ──< ProjectMember >── User
                          │
                          └──< ApprovalRequest (title, caption, dueAt, status, shareToken)
                                  │
                                  ├──< Version (v1, v2, …, note "what changed")
                                  │       └──< Asset (image file, order, width, height)
                                  │
                                  ├──< Comment (thread; optional annotation on an asset)
                                  │       author: team User OR Guest reviewer
                                  │       visibility: shared | internal
                                  │       annotation: { type: pin|box, x, y, w?, h? }  ← normalized 0–1
                                  │       resolvedAt / resolvedBy
                                  │
                                  ├──< Decision (approved | changes_requested, by whom, on which version, IP, UA)
                                  └──< Activity (audit trail)

GuestReviewer (name, email, linked ClientContact if matched) — the "identity" of a no-login client
Invitation (team invites), Notification (in-app bell)
```

Notes:
- **Annotations are stored as normalized coordinates (0–1)** relative to the image, so pins stay in the right place on any screen size.
- **Comments are tied to a version.** When v2 is uploaded, v1's pins stay on v1. Unresolved comments are listed in a "carried over from v1" panel.
- Every table carries `workspaceId` (directly or through its parent) so data is strictly isolated per agency.

### Approval request status machine

```
DRAFT ──send──▶ IN_REVIEW ──client approves──▶ APPROVED (locked)
                   │   ▲
     client requests│   │ team uploads new version
          changes   ▼   │
             CHANGES_REQUESTED

Any state ──▶ ARCHIVED / CANCELLED (team only)
```

---

## 5. Key user flows

**Flow A: Agency onboarding (target: under 3 minutes)**
Sign up → name the workspace + upload logo → invite teammates (optional, skippable) → add the first client + contact → create the first project → prompt to "Create your first approval".

**Flow B: Send for approval (target: under 60 seconds)**
Project → "New approval" → drag in images → paste caption → pick approver contacts + due date → **Send** → link copied / emails sent / WhatsApp share opened.

**Flow C: Client reviews (target: zero learning curve)**
Opens link on phone → sees the agency logo + "Review: Diwali Carousel (v1)" → enters name (if unknown) → swipes images → taps an image to pin "make logo bigger" → taps **Request changes** → done. The team gets notified.

**Flow D: Revision round**
Designer sees the pins → fixes them → uploads v2 with the note "Logo enlarged, font changed" → marks the old pins resolved → client gets a "v2 ready" email/link → client approves → request locks, and the approval is logged.

---

## 6. Screens list (MVP)

Team app:
1. Auth (sign up, log in, forgot password, accept invite)
2. Workspace switcher + create workspace
3. Workspace dashboard (status buckets)
4. Clients list → Client detail (contacts, projects)
5. Project detail (approval requests list, members)
6. New / edit approval request (upload, caption, approvers, due date)
7. Approval request detail (team view: versions, annotations, internal + shared comments, activity log)
8. Team settings (members, roles, designations, invites)
9. Workspace settings (name, logo, brand color)
10. Notifications panel
11. Profile

Client-facing:
12. **Public review page** `/r/[token]`: viewer, annotation, comments, approve/request changes, version switcher
13. Identity prompt (name + email) as a modal on the same page

---

## 7. Recommended tech stack

Next.js is the base, as you asked. Everything else is picked to stay **portable**, so moving off Next.js later only means rewriting the UI layer, not migrating the data.

| Layer | Recommendation | Why | Alternative |
|---|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Your choice. Server Actions + Route Handlers cover the whole backend for the MVP | — |
| UI | **Tailwind CSS + shadcn/ui** | Fast, good-looking, we own the component code | Mantine |
| Database | **PostgreSQL** (hosted on Neon or Supabase) | Relational data (workspace → client → project) fits Postgres perfectly | — |
| ORM | **Drizzle ORM** | Type-safe, lightweight, SQL-like, easy to move to another backend later | Prisma (more beginner-friendly, heavier) |
| Auth | **Better Auth** (email/password + Google + **organization plugin**) | Free, self-hosted, and its org plugin already covers multi-workspace membership, roles and invitations | Clerk (fastest setup, paid past free tier, vendor lock-in) |
| File storage | **Cloudflare R2** (S3-compatible) with presigned uploads | No egress fees, and images get viewed a lot | AWS S3, UploadThing, Supabase Storage |
| Image processing | Generate thumbnails + read dimensions on upload (`sharp`) | Fast review page on mobile | Cloudflare Images |
| Annotation layer | **Custom SVG overlay** on top of the `<img>` | Pins/boxes are simple, and a library would be overkill and limit the UX | Annotorious library |
| Email | **Resend + React Email** | Easy templates, good deliverability | Postmark |
| Validation | Zod | Shared between forms and server | — |
| Hosting | **Vercel** (app) + Neon (DB) + R2 (files) | Zero-ops for the MVP | Railway / Render |
| Monitoring | Sentry (errors) + PostHog (product analytics) | Know where clients drop off on the review page | — |

---

## 8. Decision Register (fill this in ✍️)

Format: **Options** → *my recommendation* → **Your decision** (blank until you answer).

### Product & scope

**D1. Niche for the MVP**
- A) Social media agencies only (copy, flows and dashboards speak "posts, carousels, captions")
- B) Any creative agency (generic "assets")
- *Recommendation: A for positioning and marketing, but keep the data model generic (an "asset" is not tied to "post") so B is easy later.*
- **Your decision:** ______

**D2. What does the client review in the MVP?**
- A) Images only (PNG/JPG/WebP), single or carousel, + caption text
- B) A + PDF
- C) A + PDF + video
- *Recommendation: A. Video is a big separate problem (timeline comments, transcoding).*
- **Your decision:** ______

**D3. Annotation tools**
- A) Pins only
- B) Pins + rectangle boxes
- C) B + freehand drawing + arrows
- *Recommendation: B. Freehand is hard to use on phones and rarely adds info.*
- **Your decision:** ______

**D4. Can the client comment on / suggest edits to the caption text?**
- A) General comments on the caption only
- B) Highlight part of the caption and comment on it
- C) "Suggest edit" mode (tracked changes on the caption)
- *Recommendation: B. Caption typos are among the most common social media revisions.*
- **Your decision:** ______

**D5. Social feed preview (show the image inside an Instagram/LinkedIn-looking frame)?**
- A) Not in MVP
- B) In MVP (Instagram feed + story frame only)
- *Recommendation: A for the first release, first thing in v1.1.*
- **Your decision:** ______

### Client access & approval behavior

**D6. How does a client access the review?**
- A) **No login.** Secret link + name/email prompt on first visit
- B) Client accounts with password
- C) A + optional link password + expiry date
- *Recommendation: C. No-login by default is the biggest reason clients actually respond.*
- **Your decision:** ______

**D7. Who can approve when a request has multiple approver contacts?**
- A) Any one approver's decision finalizes it
- B) All selected approvers must approve
- C) Configurable per request (A or B)
- *Recommendation: A for MVP (simplest for small clients), C in v1.1.*
- **Your decision:** ______

**D8. Link granularity**
- A) One link per approval request
- B) One "client portal" link per client showing all pending approvals
- C) Both
- *Recommendation: A for MVP, B in v1.1. B is a strong retention feature.*
- **Your decision:** ______

**D9. Can anyone with the link review, or only invited contacts?**
- A) Anyone with the link can comment/approve (they just enter a name)
- B) Only emails on the approver list can approve; anyone else can only view/comment
- C) Email verification (magic code) before approving
- *Recommendation: B. Keeps it frictionless but prevents "the intern approved it".*
- **Your decision:** ______

**D10. After approval**
- A) Request locks. Any further change needs a new version, which restarts review.
- B) Client can "un-approve"
- *Recommendation: A. The locked, logged approval is the value.*
- **Your decision:** ______

**D11. What does "team can communicate through Approval OS" mean for the MVP?** ⚠️ Big one
- A) **Contextual only**: threaded comments on requests, internal (team-only) comments, @mentions
- B) A + a simple per-project discussion feed
- C) A + a full chat (channels/DMs, like Slack)
- *Recommendation: A (maybe B). Full chat is a whole product, and teams will keep using WhatsApp/Slack for chat anyway.*
- **Your decision:** ______

**D12. Can the client see other client reviewers' comments?**
- A) Yes, all shared comments are visible to everyone with the link
- B) No, each reviewer sees only their own + the team's
- *Recommendation: A. Avoids duplicate feedback.*
- **Your decision:** ______

**D13. Due dates & reminders**
- A) Due date shown only
- B) Due date + automatic reminder email to the client (e.g. 24h before, and on overdue)
- *Recommendation: B. Chasing clients is the #1 pain point.*
- **Your decision:** ______

### Team & permissions

**D14. Team roles** (designation is separate, free text, display only)
- A) Owner / Admin / Member
- B) A + "Viewer" (read-only)
- C) Custom roles with permission toggles
- *Recommendation: A.*
  - Owner: everything + delete workspace + (later) billing
  - Admin: manage team, clients, projects
  - Member: work on projects they're assigned to, or on all projects? → see D15
- **Your decision:** ______

**D15. Can a Member see all clients/projects in the workspace?**
- A) Yes, everyone sees everything
- B) Only projects they're assigned to
- *Recommendation: A for MVP (small agencies are open by default). B needs extra permission checks everywhere.*
- **Your decision:** ______

**D16. Team login methods**
- A) Email + password
- B) A + Google sign-in
- C) Magic link only (passwordless)
- *Recommendation: B.*
- **Your decision:** ______

### Notifications & sharing

**D17. Notification channels for MVP**
- A) Email + in-app bell
- B) A + WhatsApp messages sent automatically (requires the WhatsApp Business API: approval process, per-message cost)
- C) A + a manual "Share on WhatsApp" button (just opens WhatsApp with the link prefilled, free)
- *Recommendation: C.*
- **Your decision:** ______

### Branding & business

**D18. Agency branding on the client review page**
- A) Approval OS branding only
- B) Agency logo + name + brand color, with a small "Powered by Approval OS"
- C) Full white-label (custom domain, no Approval OS branding)
- *Recommendation: B in MVP. The "Powered by" line is also free marketing to every client.*
- **Your decision:** ______

**D19. Monetization at launch**
- A) Free closed beta, no billing code
- B) Paid from day 1 (Stripe/Razorpay)
- *Recommendation: A. Validate the product first. Decide pricing model (per workspace vs per seat vs per active client) after ~10 agencies use it.*
- **Your decision:** ______

**D20. Primary market** (affects payments, WhatsApp emphasis, currency, date formats)
- A) India
- B) US/UK/global
- C) Both from day one
- *Recommendation: depends on where your first 10 agencies are. Tell me.*
- **Your decision:** ______

### Tech

**D21. Stack** (see section 7)
- A) Recommended: Next.js + Drizzle + Postgres (Neon) + Better Auth + R2 + Resend + Vercel
- B) All-in-one Supabase (DB + Auth + Storage + Realtime) with Next.js (faster start, more lock-in)
- C) Something else you prefer
- *Recommendation: A, because you mentioned you might switch stacks later.*
- **Your decision:** ______

**D22. File limits**
- A) 20 MB per image, 20 images per request
- B) Other
- *Recommendation: A.*
- **Your decision:** ______

**D23. Realtime**
- A) No realtime. Refresh/poll every ~15s on the review page
- B) Live updates (comments appear instantly) via websockets/Pusher/Supabase Realtime
- *Recommendation: A for MVP.*
- **Your decision:** ______

**D24. Naming in the UI: "Company" vs "Workspace" vs "Agency"**
- *Recommendation: "Workspace" in the UI, with the agency's name shown prominently. "Company" gets confusing because clients are companies too.*
- **Your decision:** ______

---

## 9. Behavior questions (not really either/or, I just need your answer)

1. **Who creates approval requests?** Anyone on the team, or only certain roles (e.g. account managers)?
2. **Does the team review internally before the client sees it?** (e.g. designer → account manager OK → then sent to client). If yes, is that MVP or v1.1?
3. **What fields do you need on a Client** beyond name, logo, website, industry, notes? (e.g. GST/tax ID, address, social handles, contract dates)
4. **What fields on a Project?** Is a project a *campaign* ("Diwali 2026"), a *retainer* ("Monthly social – Oct"), or both?
5. **Project statuses**: Active / On hold / Completed / Archived. Enough?
6. **Can a client contact belong to multiple clients?** (e.g. a freelancer marketing manager handling 2 brands)
7. **Can the same person be a team member in one workspace and a client in another?** (the model supports it, just confirming)
8. **Should clients be able to upload files** (e.g. "use this logo instead") in their comments?
9. **Download**: can the client download the final approved images?
10. **Deleting**: when a client/project is deleted, archive (recoverable) or hard delete?
11. **Language**: English only for MVP?
12. **Do you already have agencies lined up** to beta test? Their workflows should shape the defaults.

---

## 10. Build milestones (once decisions are locked)

| # | Milestone | Outcome |
|---|---|---|
| M0 | Project setup | Next.js + TS + Tailwind/shadcn + Drizzle + DB + lint/format + CI + deployed "hello world" |
| M1 | Auth & workspaces | Sign up/in, create/switch workspaces, invite members, roles & designations |
| M2 | Clients, contacts, projects | CRUD screens, lists, detail pages |
| M3 | Approval requests (team side) | Create request, upload images to R2, caption, approvers, versions, share link |
| M4 | **Client review page** | Mobile-first viewer, pins + boxes, comments, approve / request changes, identity prompt |
| M5 | Collaboration | Threads, internal comments, @mentions, resolve, activity log |
| M6 | Notifications & dashboard | Emails, in-app bell, reminders, status dashboard |
| M7 | Polish & beta | Empty states, onboarding, error tracking, analytics, security pass, invite first agencies |

M4 is the heart of the product and should get the most design and testing time. It's the only screen the client ever sees.

---

## 11. Risks & how the plan handles them

| Risk | Mitigation |
|---|---|
| Crowded market | Win on client UX (no login, mobile-first, 10-second approval) and agency structure; keep MVP tiny and ship fast |
| Share links leak | Long unguessable tokens, optional password + expiry (D6), approver-only approval (D9), ability to revoke/regenerate the link |
| "We never approved that" disputes | Immutable decision log with version, name, email, timestamp, IP |
| Pins misplaced on different screens | Normalized coordinates + comments pinned to a specific version |
| Scope creep (chat, scheduling, video) | Out-of-scope list in section 3. Anything new goes to v1.1 backlog unless it replaces something |
| Future stack change | Postgres + S3-compatible storage + typed service layer separate from UI components |

---

## Sources (research)

- [BugHerd: Best online proofing tools 2026](https://bugherd.com/blog/best-online-proofing-tools)
- [Approval Studio: Creative review software for design agencies 2026](https://approval.studio/blog/creative-review-software-for-design-agencies/)
- [Kreatli: Filestage alternatives 2026](https://kreatli.com/comparisons/filestage-alternatives-2026)
- [ClientProof: Filestage vs Ziflow vs ClientProof](https://clientproof.app/blog/best-creative-approval-software-2026/)
- [Planable: Approval software for agencies](https://planable.io/blog/approval-software/)
- [Kontentino: Best social media approval tools 2026](https://www.kontentino.com/blog/best-social-media-approval-tools/)
- [SocialPilot: Social media approval software](https://www.socialpilot.co/social-media-approval-software)
