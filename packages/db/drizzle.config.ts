import type { Config } from 'drizzle-kit';

// `drizzle-kit generate` reads schema.ts and emits SQL — no DB connection
// needed. `migrate` / `push` / `studio` DO need DATABASE_URL; the migrate
// script (src/migrate.ts) checks for it explicitly.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@localhost:5432/placeholder';

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
} satisfies Config;
