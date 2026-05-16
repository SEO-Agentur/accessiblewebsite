# CLAUDE.md — context for future agent runs

This is the handoff brief. Read it first.

## Project

**AccessibleWebsite / Barrierefreiewebseite** — a bilingual WCAG 2.2 AA
accessibility scanning + remediation platform. One Astro codebase serves two
domains: `accessiblewebsite.net` (English, default for non-DACH) and
`barrierefreiewebseite.net` (German, default for DE/AT/CH).

Locale is determined by the **Host header** at request time, not the URL
path or a subfolder. The route slugs themselves are translated (see
`apps/web/src/i18n/routes.ts`).

## Why Astro and not Next.js

The product sells accessibility. Zero JavaScript by default is a brand
requirement. Every page must function without JavaScript enabled. The full
reasoning is in the brief and the earlier handoff conversation; do not
revisit this decision.

## VPS deployment (sibling to seowebsitesbuilder)

- VPS: Hostinger, `187.77.74.66`, root SSH at `~/.ssh/seowebsitesbuilder_vps`
- Project root on VPS: `/opt/accessiblewebsite/`
- This stack is COMPLETELY independent of `/opt/seowebsitesbuilder/`.
  Never touch the seowebsitesbuilder Caddyfile blocks, pm2 processes,
  Postgres container, or `.env`.
- Ports: Astro SSR `127.0.0.1:4100`, Postgres `127.0.0.1:5433`,
  Redis `127.0.0.1:6380`. (seosites uses 3000, 4000, 5432.)
- pm2 processes: `accessiblewebsite-web`, `accessiblewebsite-scanner`.
  Do NOT replace seosites' pm2 entries.
- Caddy: site blocks for the two new domains appended to the bottom of
  `/etc/caddy/Caddyfile`. Both proxy to `127.0.0.1:4100`.
- TLS: Cloudflare Origin Cert at `/etc/caddy/cf-origin.crt` + `.key`,
  SAN list extended to include both new apex + wildcard domains.

## Repo layout

```
apps/
  web/         Astro 4 + Preact islands + Node SSR adapter
  scanner/     Playwright + axe-core BullMQ worker (concurrency=1)
packages/
  db/          Drizzle schema + migrations (shared by web & scanner)
  shared/      Zod schemas, types shared web<->scanner
docker-compose.yml    name: accessiblewebsite (Postgres + Redis)
ecosystem.config.cjs  pm2 — loads .env at boot
```

## Conventions

- **TypeScript strict** everywhere. `noImplicitAny`, `strictNullChecks`,
  `noUncheckedIndexedAccess`.
- **Zod for input validation** at every API boundary.
- **Tailwind** in `apps/web`. Plain CSS only inside `<style>` Astro blocks
  for tightly-scoped tweaks.
- **Server components by default**. Preact islands (`client:*`) only where
  state/effects are genuinely needed — see the explicit list in the brief.
- **i18n strings**: all UI copy in `src/i18n/{en,de}.json`. No hardcoded
  text in templates.
- **Route mapping**: `src/i18n/routes.ts` is the single source of truth.
  Adding a new page = adding a new key with both `en` and `de` slugs.
- **German tone**: formal `Sie`, B2B professional, never casual.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).

## Non-negotiable accessibility rules

- Every form must submit successfully with JavaScript disabled (standard
  `<form method="POST">` + server-rendered response page).
- Language switcher is plain `<a>` tags pointing at the equivalent URL on
  the other domain — JS only enhances styling.
- `prefers-reduced-motion` respected for every animation.
- Native `<details>`/`<summary>` for accordions, no JS-only versions.
- Visible focus indicators on everything interactive. Never
  `outline: none` without a replacement.
- Run the site through its own scanner before launch. Target 100/100.

## Verification commands

```bash
# Typecheck the whole workspace
pnpm typecheck

# Local dev (web + scanner — pick one terminal each)
pnpm dev:web
pnpm dev:scanner

# Stand up local Postgres + Redis (matches VPS layout)
docker compose up -d
docker compose ps

# Drizzle: generate + apply migrations
pnpm db:generate
pnpm db:migrate
```

## Memory budget on VPS (7.8 GB total, no swap)

- seowebsitesbuilder stack: ~1.5 GB
- Caddy: ~50 MB
- New Postgres: ~150 MB
- New Redis: ~30 MB
- Astro SSR: ~200–350 MB
- Scanner (active w/ Chromium): up to 800 MB — capped at 900 MB by pm2
- Headroom during a scan: ~4.6 GB ✓

If the scanner consistently approaches 900 MB or queue depth grows, the
migration to a remote Chromium (Browserless.io or self-hosted on a side
box) is a small change because Playwright connects over WebSocket either
way. Do not migrate prematurely.
