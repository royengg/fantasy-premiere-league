# Fantasy Cricket Club MVP

Web-first play-money fantasy cricket for public contests and private friend leagues. Users build salary-cap teams, answer fixed prediction questions, and unlock `XP`, `badges`, and `cosmetics` only. The scaffold explicitly excludes deposits, wallets, cash-out, redeemable rewards, transfers, resale, and market mechanics.

## Stack

- Web: React + Vite + TypeScript
- API: Node.js + Express + TypeScript
- Shared packages: types, validators, domain logic, scoring, API client
- Infra: Neon Postgres, Redis, BullMQ, Socket.IO, Prisma ORM 7

## Workspace

- `apps/web`: React dashboard for contests, leagues, predictions, and cosmetics
- `apps/api`: Express API with seeded in-memory data, route validation, realtime hooks, and Prisma schema
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
4. Start Redis locally with `docker compose up -d`.
5. Generate the Prisma 7 client with `bun run prisma:generate`.
6. Push the schema with `bun run prisma:push` or create a migration with `bun run prisma:migrate`.
7. Run the API with `bun run dev:api`.
8. Run the web app with `bun run dev:web`.

The current API still uses seeded in-memory records so the UI is immediately usable. Prisma is configured in the v7 style for Neon: [`apps/api/prisma.config.ts`](/Applications/Code/nodejs/fantasy-premiere-league/apps/api/prisma.config.ts) points the CLI at `DIRECT_URL`, while the runtime client uses the pooled `DATABASE_URL` through `@prisma/adapter-neon`.

## Guardrails

- Rewards are cosmetic only and cannot be transferred, redeemed, resold, or converted into gameplay advantages.
- Predictions are fixed questions, not peer-to-peer markets or contracts.
- No official league logos, brand assets, or affiliation claims are included.
