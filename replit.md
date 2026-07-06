# FitTrack

A mobile-first fitness progress tracker. Log workouts, track sets with exercises, set goals, visualize progress charts, and get AI coaching after sessions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/fitness-app run dev` — run the frontend (port 21558, served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild lib declarations (run this after changing `lib/*`)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-exercises` — seed the 44 default exercises
- Required env: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, wouter, TanStack Query, Recharts
- API: Express 5 at `/api`
- DB: PostgreSQL + Drizzle ORM
- Auth: Supabase Auth (JWT verified on server via `SUPABASE_SERVICE_ROLE_KEY`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- AI: OpenAI API (ai-coach endpoint, `OPENAI_API_KEY`; optional `OPENAI_MODEL`)
- Build: esbuild (CJS bundle for server)

## Where things live

- `artifacts/fitness-app/` — React Vite frontend, served at `/`
- `artifacts/api-server/` — Express 5 API server, served at `/api`
- `lib/db/src/schema/` — Drizzle schema (exercises, workouts, workout_sets, goals)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — Generated React Query hooks (from codegen)
- `lib/api-zod/` — Generated Zod validation schemas (from codegen)
- `scripts/src/seed-exercises.ts` — Exercise catalog seeder

## Architecture decisions

- Contract-first API: OpenAPI spec → codegen → Zod schemas on server, React Query hooks on client
- Supabase JWT middleware (`requireAuth`) extracts `userId` from JWT sub claim; all DB queries filter by `userId`
- `date()` columns in Drizzle (string type) — Zod schemas coerce to `Date`, so server routes convert back with `.toISOString().split("T")[0]` before inserting
- Drizzle `numeric()` columns return strings — server normalizes these to numbers before returning JSON
- Dark mode applied globally via `class="dark"` on `<html>` — athletic dark theme with electric lime (`hsl(82 100% 50%)`) primary

## Product

- **Auth**: Supabase email/password sign-in and sign-up
- **Dashboard**: stats grid (total workouts, streak, this-week count, avg duration) + 8-week volume area chart + recent workouts
- **Workout logging**: create workout → add sets per exercise (44 seeded exercises across all muscle groups)
- **Goals**: create, track progress, and complete personal fitness goals with a progress bar
- **Progress**: weekly volume + frequency line charts, personal records table
- **AI Coach**: chat interface with optional workout context; uses the OpenAI API with `OPENAI_API_KEY`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing any `lib/*` package, run `pnpm run typecheck:libs` before checking leaf artifacts — stale declarations cause false type errors
- Zod `coerce.date()` returns a `Date` object; Drizzle `date()` column expects a string — always convert when inserting
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set as plain env vars (not just secrets) so Vite can embed them at build time

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
