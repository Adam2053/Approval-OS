# Approval OS

Client approvals for agencies. Upload a creative, send one link (WhatsApp or email), and the client drops pins, comments on the caption, and approves. No client login needed. Every approval is recorded against a specific version.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Drizzle ORM + Postgres, and Better Auth.

## Run it locally (2 minutes, zero setup)

```bash
npm install
npm run dev
```

Open http://localhost:3000, create an account, and create your agency workspace.

No database or API keys are needed to try it:
- **Database:** without `DATABASE_URL`, an embedded Postgres (PGlite) is stored in `./.data/pglite`. Migrations run automatically on startup.
- **Files:** uploads go to `./.data/uploads`.
- **Email:** without `RESEND_API_KEY`, emails (invites, approval requests, reminders) are **printed in the terminal**, so you can copy invite and review links from there.

To test the client side, send an approval, copy the review link, and open it in a private/incognito window or on your phone.

## Deploy (Vercel + Neon, free tiers)

1. Create a Postgres database on [Neon](https://neon.tech) (or Supabase) and copy the connection string.
2. Create an S3-compatible bucket (e.g. Cloudflare R2). Serverless hosts have no persistent disk, so this is required.
3. Import this repo on [Vercel](https://vercel.com/new) and set the env vars from `.env.example`: at least `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your Vercel URL) and the `S3_*` values. Add `RESEND_API_KEY` for real emails and `CRON_SECRET` for reminder emails.
4. Deploy. Migrations run on first boot, and `vercel.json` schedules the hourly reminder cron.

## What’s in the MVP

- **Workspaces:** a user can own or join several agencies, each with a team of owner/admin/member roles plus a free-text designation.
- **Clients → contacts → projects:** contacts have WhatsApp numbers and an “approver” flag.
- **Approval requests:** single images or carousels plus caption, platform and due date, with versions (v1, v2…) on the same link.
- **Internal approval first:** a per-project toggle, on by default. A teammate (not the uploader) or an admin approves before anything can be sent.
- **Only project members can request approvals** (admins can always).
- **Client review page** (`/r/…`): mobile-first, no login. Pins, boxes, comments on selected caption text, threads, and approve or request changes. **One approver’s decision is final.**
  - Personal links (`?k=…`) identify the contact automatically, and the decision is marked *verified*.
  - The shared/group link asks for a name and email. Approvers are matched by email, and the decision is marked *self-identified*.
- **WhatsApp-first sharing:** one-tap WhatsApp buttons per contact (`wa.me` with a prefilled message) and a “share to group” link.
- **Approval trail:** who sent, viewed, commented and approved, with timestamps, version and IP.
- **Team chat:** public and private channels, DMs and group DMs, threads, @mentions, reactions, file attachments and unread counts.
- **Project discussions + decision log:** every project has its own discussion channel. Any message can be logged as a decision, and client approvals are logged automatically.
- **Notifications:** in-app bell plus email for internal reviews, client decisions and mentions. Automatic due-date reminders go to clients.

Chat and review pages update by polling every few seconds, with no websocket infrastructure needed.

## Project layout

```
src/
  app/                 routes (App Router)
    (auth)/            sign in / up / reset
    w/[slug]/          workspace app: dashboard, approvals, clients, projects, chat, team, settings
    r/[token]/         public client review page
    api/               route handlers (uploads, files, chat, review, notifications, cron)
  components/          UI kit, review workspace (annotations), chat
  db/                  Drizzle schema, client (Postgres or PGlite), migrations runner
  lib/                 auth, approvals workflow, chat, comments, email, storage, permissions
drizzle/               SQL migrations (`npm run db:generate` after schema changes)
docs/MVP_PLAN.md       product plan and decisions
```

## Ready for WhatsApp automation (next phase)

Comments carry a `source` field (`web` | `email` | `whatsapp`), contacts store E.164 phone numbers, and every approval has a stable share token and per-contact access keys. A WhatsApp Business webhook can map inbound group messages to requests and create comments or decisions through the same `lib/approvals.ts` and `lib/comments.ts` functions the web UI uses.
