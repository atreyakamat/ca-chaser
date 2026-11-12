# DocChase

> Working name. Rename in `src/lib/site.ts`.

Collects monthly GST and TDS documents for CA firms. Each client gets a reminder with a personal upload link, follow-ups until everything is in, and the firm sees one dashboard of what's still pending.

## What works

- Firm sign-up and sign-in (email and password)
- Clients: add, edit, deactivate, CSV import, per-client document checklist, WhatsApp consent flag
- Custom document types
- Monthly requests that open automatically, with a signed upload link per client
- Mobile upload page with no login: PDF, photos, Excel and CSV up to 5 MB
- Dashboard grid by month with filters, nudge, copy link and ZIP download
- Reminder schedule: first request, follow-ups before the due date, two overdue reminders
- Activity log of every reminder

Not built yet: live WhatsApp sending (Meta Cloud API), billing, team invites, password reset.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Cache Components) + TypeScript |
| UI | Tailwind CSS 4, Motion, lucide icons, light and dark themes |
| Data | PostgreSQL with SQL migrations and row-level security (Supabase in production) |
| Auth | scrypt password hashes, signed HTTP-only session cookie (jose) |
| Files | Private storage: local disk in development, Supabase Storage in production |
| Messaging | Mock sender by default; email through Resend when live |
| Tests | Vitest (unit and real-Postgres integration), Playwright (end-to-end) |
| CI / hosting | GitHub Actions, Netlify (with a scheduled function for the daily run) |

## Getting started

Requirements: Node 22+, pnpm 10, Postgres 15+.

```bash
pnpm install
cp .env.example .env.local    # then fill in SESSION_SECRET and CRON_SECRET
createdb cachaser
pnpm db:deploy                # apply migrations
pnpm dev                      # http://localhost:3000
```

In development reminders are recorded but never sent (`MESSAGING_MODE=mock`), and files are kept in `.data/uploads`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |
| `pnpm test` | Unit tests, plus database tests when `TEST_DATABASE_URL` is set |
| `pnpm test:e2e` | Playwright against a production build (run `pnpm build` first) |
| `pnpm db:deploy` | Apply pending migrations in `db/migrations` |

## How tenant isolation works

Every tenant table has a `firm_id` and row-level security. Signed-in code runs its queries through `withFirm(firmId, …)`, which opens a transaction, switches to the unprivileged `app_user` role and sets `app.firm_id`. The policies then limit every read and write to that firm, so a query that forgets its `WHERE` clause still cannot leak another firm's data. `asSystem(…)` skips this and is used only for sign-in, verified upload links and the scheduler. `tests/tenancy.test.ts` proves the isolation against a real database.

## How reminders work

Documents for month M are requested on the firm's request day of month M+1 and due on its due day (defaults: 1st and 10th). The daily job (`POST /api/cron/reminders`, called by `netlify/functions/daily-reminders.mjs` at 09:00 IST) opens the period, then messages each client who still owes something on scheduled days. Each scheduled send is recorded with a per-day key before it goes out, so running the job twice never double-sends. A WhatsApp message is only ever addressed to a client with recorded consent.

## Deploying

1. Create a Supabase project. Copy its pooled connection string to `DATABASE_URL`, and create a **private** storage bucket named `client-documents`.
2. In Netlify, set `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `STORAGE_DRIVER=supabase`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy. Production builds run `pnpm db:deploy` first.
4. To send real email, verify a domain in Resend and set `MESSAGING_MODE=live`, `RESEND_API_KEY` and `EMAIL_FROM`.

## Layout

```
db/migrations/        SQL migrations
scripts/migrate.mjs   migration runner
netlify/functions/    scheduled trigger for the daily run
src/app/              routes: landing, /login, /signup, /app/*, /u/[token], /api/*
src/components/       UI primitives, app shell, forms
src/lib/              pure logic: dates, periods, validation, CSV, files, templates
src/server/           server-only code: db, auth, actions, queries, storage, messaging, reminders
tests/                Vitest unit and integration tests
e2e/                  Playwright tests
```

## Run with Docker (demo)

```bash
docker compose up --build
```

Open http://localhost:3000 and sign in with the seeded demo account: `demo@docchase.test` / `demo-password-123`.

- Starts Postgres 16 and the app, applies migrations, and seeds a demo firm (8 clients, mixed progress). Seeding is skipped if the demo user already exists.
- Messaging runs in mock mode: reminders are recorded in Activity, never sent to anyone.
- Uploaded files and the database live in Docker volumes. `docker compose down -v` resets everything.
- The secrets in `docker-compose.yml` are throwaway demo values. Use real ones (see `.env.example`) for anything beyond a local demo.
