# Fantasy Cricket Club MVP

Web-first play-money fantasy cricket for public contests and private friend leagues. Users build salary-cap teams, answer fixed prediction questions, and unlock `XP`, `badges`, and `cosmetics` only. The scaffold explicitly excludes deposits, wallets, cash-out, redeemable rewards, transfers, resale, and market mechanics.

## Stack

- Web: React + Vite + TypeScript
- API: Node.js + Express + TypeScript
- Shared packages: types, validators, domain logic, scoring, API client
- Infra: Neon Postgres, Socket.IO, Prisma ORM 7

## Workspace

- `apps/web`: React dashboard for contests, leagues, predictions, and cosmetics
- `apps/api`: Express API with Prisma-backed persistence, first-run seed bootstrap, route validation, and realtime hooks
- `packages/types`: shared contracts
- `packages/validators`: zod payload validation
- `packages/domain`: roster, invite, level, and inventory rules
- `packages/scoring`: fantasy scoring and prediction settlement
- `packages/api-client`: typed browser client
- `tests`: domain-level rule coverage

## Local Run

1. Install dependencies with `bun install`.
2. Create a Neon database and copy `.env.example` to `.env`.
3. Fill `DATABASE_URL` with Neon’s pooled connection string and `DIRECT_URL` with Neon’s direct connection string.
4. `CORS_ORIGIN` accepts a comma-separated allowlist. For local Bun/Vite dev, keep both `http://localhost:5173` and `http://localhost:5174` if you switch ports.
   Set `CRICKET_DATA_API_KEY` if you want provider ingestion and live IPL sync to work. The default provider base URL is `https://api.cricapi.com/v1`.
5. Start local Postgres with `docker compose up -d` only if you want a non-Neon local database.
6. Generate the Prisma 7 client with `bun run prisma:generate`.
7. Push the schema with `bun run prisma:push` or create a migration with `bun run prisma:migrate`.
8. Run the API with `bun run dev:api`.
9. Run the web app with `bun run dev:web`.

On first boot, the API seeds the database with catalog data only: teams, players, cosmetics, badges, a sample public contest, and a public league. It does not create demo user accounts or known-password credentials in runtime. Prisma is configured in the v7 style for Neon: [`apps/api/prisma.config.ts`](/Applications/Code/nodejs/fantasy-premiere-league/apps/api/prisma.config.ts) points the CLI at `DIRECT_URL`, while the runtime client uses the pooled `DATABASE_URL` through `@prisma/adapter-neon`.

The API is Prisma/Neon-only at runtime. If the database cannot authenticate, connect, or finish startup, the server exits instead of falling back to a local store.

The frontend now uses real email/password auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `PATCH /api/auth/onboarding`

The frontend stores a session token, not a raw user ID. New users are forced through a first-run onboarding step to pick a username and favorite team. Admin routes require an authenticated session for a user whose `isAdmin` flag is set in the database. On a brand-new database, the first registered account is promoted to admin automatically.

Provider sync is DB-first:
- User-facing reads come from Neon-backed app state, not directly from the cricket provider.
- A background scheduler refreshes provider data before match days and stores normalized teams, players, matches, public contests, and winner questions in the database.
- `POST /api/admin/provider-sync` still exists as an admin override, but the normal product flow reads only from stored data.

## Guardrails

- Rewards are cosmetic only and cannot be transferred, redeemed, resold, or converted into gameplay advantages.
- Predictions are fixed questions, not peer-to-peer markets or contracts.
- No official league logos, brand assets, or affiliation claims are included.
