# AccessibleWebsite / Barrierefreiewebseite

Bilingual WCAG 2.2 AA accessibility scanning + remediation platform.
One Astro codebase, two domains, one shared database.

- **EN**: https://accessiblewebsite.net
- **DE**: https://barrierefreiewebseite.net

## Stack

- Astro 4 (hybrid SSR/SSG) + Preact islands
- TypeScript strict, Zod at API boundaries
- Drizzle ORM + Postgres
- Lucia Auth
- BullMQ + Redis for the scan job queue
- Playwright + axe-core for the scanner worker
- Stripe billing, Resend email, S3 reports, Sentry, Plausible
- Tailwind CSS

## Layout

```
apps/web         Astro frontend + SSR API routes
apps/scanner     Playwright + axe-core BullMQ worker
packages/db      Drizzle schema + migrations
packages/shared  Zod schemas shared web <-> scanner
```

## Local development

```bash
pnpm install
cp .env.example .env   # then edit
docker compose up -d   # local Postgres + Redis
pnpm db:migrate
pnpm dev:web           # http://localhost:4100
pnpm dev:scanner       # background worker
```

## Deploy

See `CLAUDE.md` for the VPS-side layout and rsync workflow.
