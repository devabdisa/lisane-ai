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
cp .env.example .env.local
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
