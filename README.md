# DocChase

> Working name. Rename in `src/lib/site.ts`.

Automatic WhatsApp reminders that collect monthly GST and TDS documents from a CA firm's clients, with one dashboard showing what's still pending.

This branch is **step 1** of the build plan: the app scaffold, design tokens, landing page, tests and CI. Auth, data, uploads and reminders follow in later PRs.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4, Motion, lucide icons, light and dark themes |
| Tests | Vitest (unit), Playwright (end-to-end, desktop and mobile) |
| CI / hosting | GitHub Actions, Netlify |
| Planned | Supabase (Postgres, auth, storage), Netlify scheduled functions, WhatsApp Cloud API behind a provider interface |

## Getting started

Requirements: Node 22+, pnpm 10.

```bash
pnpm install
cp .env.example .env.local
pnpm dev                      # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | Playwright against a production build (run `pnpm build` first) |

## Layout

```
src/app/              routes: landing (/), /api/health
src/components/ui/    primitives (Button, ButtonLink)
src/components/landing/  landing-page illustrations
src/lib/              site config, pricing, helpers
tests/                Vitest unit tests
e2e/                  Playwright tests
```
