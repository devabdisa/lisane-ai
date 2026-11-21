# Lisane AI (ልሳኔ AI)

English should never be the reason talented Ethiopians miss opportunities.

Lisane is a mobile-first PWA for speaking English with confidence: AI speaking practice anytime, plus a step-by-step learning path, with support in the learner's own language (Amharic and Afaan Oromo first).

See [`../AGENTS.md`](../AGENTS.md) for the product scope, architecture rules and roadmap.

## Requirements

- Node 24
- pnpm 12

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, BETTER_AUTH_SECRET, GEMINI_API_KEY, ADDIS_API_KEY
pnpm exec prisma migrate deploy
pnpm db:generate
pnpm curriculum:sync
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types and run TypeScript |
| `node --test "src/**/*.test.ts"` | Unit tests |
| `pnpm messages:draft` | Draft missing Amharic and Afaan Oromo strings with Addis AI |
| `pnpm curriculum:validate` | Validate curriculum files, enabled languages, and exercise references |
| `pnpm curriculum:sync` | Validate and sync the saved English units to the configured database |

Run `pnpm curriculum:sync` after changing curriculum JSON. The files define the full English path. The sync updates rows by stable IDs and hides units or levels removed from the files. Keep those IDs when editing content so learner progress stays attached.

The signed-in `GET /api/learn/path` endpoint returns ordered sections, units and level states. Guidebooks use the profile's support language and include their draft or approved status.
