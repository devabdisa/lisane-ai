# AGENTS.md: Lisane AI (ልሳኔ AI)

This is the working agreement for the AI agent that builds Lisane AI. The agent reads it at the start of every session and follows it on every step. The owner reviews and edits it; the agent does not change it without asking.

> Mission: English should never be the reason talented Ethiopians miss opportunities.

---

## 1. What we are building

Lisane AI is a mobile-first PWA that turns Ethiopians who understand English into confident English **speakers**, with deep support in the learner's own language. It has two main features:

1. **Speak anytime.** The learner opens a conversation with an AI English coach whenever they want, by text or recorded voice, freely or in a scenario like a job interview. Every turn gets one short, kind correction. The explanation is written in the learner's chosen support language by **Addis AI**, so it reads naturally instead of like a machine translation.
2. **Learn step by step.** A Duolingo-style learning path for English: sections, units, levels and short lessons. It mixes new material with review and uses spaced repetition to bring weak items back. Guidebooks, hints and translation exercises use the learner's support language.

Both features feed one shared **memory**: mistakes from speaking and from lessons become practice items that return at the right time.

Around them: a fully localized UI, low-network resilience, and a free daily limit plus paid access through Chapa.

---

## 2. Workspace map

| Path | What it is | Rules |
|---|---|---|
| `lisane/` | The new Lisane AI app (single Next.js app, no monorepo) | All new work goes here |
| `talkbuddy/` | Voxa, the previous product | **Read-only reference.** Never edit, build, migrate or commit in it |
| `talkbuddy/apps/platform/` | Voxa's main Next.js app | Copy from it, never import from it |
| `talkbuddy/docs/` | Voxa product and QA notes | Read before porting a related feature |
| `AGENTS.md` | This file | Owner-approved changes only |

---

## 3. How we work: step by step, never in one shot

1. **One step at a time.** Pick only the next unchecked step in the roadmap (section 12). Never combine steps, and never start the next one in the same turn unless the owner says so.
2. **Before coding a step**, state in 2–5 lines:
   - the goal of the step
   - which files will be created or changed
   - which Voxa files will be ported, if any
   - how the result will be verified
3. **Keep the change small.** A step should be reviewable in a few minutes. If it grows past roughly 15 files or one clear concern, split it and tell the owner.
4. **Verify** (section 11) before saying a step is done.
5. **Stop and report:**
   - what changed
   - how it was verified
   - anything skipped or uncertain
   - the proposed next step

   Then wait for the owner's go-ahead.
6. **Mark progress.** Tick the step in section 12 only after the owner approves it.
7. **Ask instead of guessing** when a decision is product-level: pricing, copy tone, mascot, provider choice, curriculum scope, or schema changes beyond the step.
8. **Commit only when the owner asks.** Use one commit per step with a clear message, for example `step 03: next-intl locale routing`.

---

## 4. Versions: always latest stable, checked live

- **Never pick versions from memory.** Before adding or upgrading a dependency, run `npm view <pkg> version` (and `npm view <pkg> dist-tags` when unsure) and use the latest **stable** release, not `rc`, `beta` or `canary`.
- Scaffold with the latest tooling: `pnpm create next-app@latest`.
- Read the current official docs or upgrade guide for any major version that differs from what Voxa used. Do not assume Voxa-era APIs still work.
- If a latest version breaks compatibility with another required package, report it and propose the newest working combination. Do not silently downgrade.
- Versions observed on 2026-11-21 (re-check at install time):

| Package | Latest seen | Note |
|---|---|---|
| `next` | 16.4.6 | Voxa was on 15. Use Next 16 conventions (see below) |
| `react` / `react-dom` | 19.3.1 | |
| `tailwindcss` | 4.3.5 | Voxa was on 3. v4 uses CSS-first config (`@import "tailwindcss"`, `@theme`) and has no `tailwind.config.ts` by default |
| `typescript` | 7.0.2 | Use whatever `create-next-app@latest` installs. Only bump if Next supports it |
| `prisma` / `@prisma/client` | 8.0.0-rc (pre-release), 7.10.1 stable | Use the latest **stable** Prisma |
| `next-intl` | 4.15.3 | |
| `@serwist/next` / `serwist` | 9.5.15 | Check Turbopack support in the current Serwist docs before choosing the integration |
| `better-auth` | 1.7.27 | Voxa was on 1.6 |
| `zod` | 4.6.7 | |
| `dexie` | 4.4.7 | |
| `@google/genai` | 3.6.1 | Voxa was on 1.x. Re-check the API while porting |
| `addisai` | 0.14.0 | Official Addis AI SDK. Server-only |
| `pnpm` | 12.21.0 | Package manager for `lisane/` |
| Node | 24.x on this machine | |

**Next 16 conventions to respect:** Turbopack is the default bundler, `proxy.ts` replaces `middleware.ts`, request APIs (`params`, `searchParams`, `cookies()`, `headers()`) are async, and `next lint` is gone (use ESLint directly). Confirm each of these against the current Next docs at scaffold time.

---

## 5. Product guardrails

- **MVP scope:**
  - Speak anytime (text plus recorded voice, free talk plus scenarios)
  - corrections with a support-language explanation
  - "help me say it", which turns the learner's own-language sentence into natural English
  - the Duolingo-style learning path with lessons and speaking roleplays
  - shared spaced-repetition memory and personal practice
  - XP, streak and daily goal
  - progress
  - a fully localized UI
  - low-network mode
  - free daily limit, Plus pass and top-ups through Chapa
- **Not in the MVP:**
  - the separate interactive reader or passage library
  - PDF upload
  - realtime Gemini Live voice
  - peer matching and leaderboards
  - teacher or class plans
  - the mobile app
- **No hearts or energy that punish mistakes.** Our promise is "no judgment". Free-tier limits apply to AI usage, not to making mistakes.
- **Target skill is English speaking.** Gemini judges and speaks English (conversation, correction, STT, TTS). Addis AI owns everything in the learner's own language.
- **Tone:** kind, encouraging, no judgment. Corrections are short and practical, one per turn.
- **Design source:** the Figma file "Lisane AI · Midnight lime" is the visual source of truth. Build screens from its frames and tokens; only the responsive layout for wider screens is our own, inspired by the design.
- **Light and dark mode:** both themes are first-class. Dark (Midnight) is the default, Light / Contrast-safe is the alternative, and the learner can choose System, Light or Dark. Use only theme tokens (`bg-canvas`, `text-fg`, and so on), never raw colors, and keep lime on Midnight surfaces only.
- **Mascot:** a new Lisane mascot (not Voxa's Lumi or Saba). Until art exists, use a single placeholder `Mascot` component.

---

## 6. Support languages (extensible by design)

- The learner **chooses their support language** in onboarding and can change it in their profile. This is separate from the UI language, though it defaults to it.
- MVP support languages: Amharic (`am`, Ethiopic script) and Afaan Oromo (`om`, Latin script / Qubee), plus `en` for English-only.
- **More Ethiopian languages will be added later** (for example Tigrinya `ti`, which Addis translate already supports). So:
  - One registry, `src/config/languages.ts`, defines each language: code, native name, script, font, text direction, Addis support flags (`translate`, `chat`, `stt`, `tts`), and whether it is enabled.
  - Never hard-code `am`/`om` in conditionals, prompts, schemas or the database. Use the registry. Database columns store a language code string, not an enum of two values.
  - Curriculum content stores translations as a map keyed by language code, so a new language means adding keys, not changing code.
  - Adding a language should come down to registry, messages, content translations and a review pass.
- Machine-drafted support-language text is marked for native-speaker review until a reviewer approves it.

---

## 7. Feature rules

### 7.1 Speak anytime
- **Split the work by strength:**
  1. Gemini writes the English reply and judges the learner's English, returning strict JSON: `hasCorrection`, `original`, `corrected`, `type` (`GRAMMAR | VOCABULARY | PHRASING`), a short English `reason`, and a short `tip`.
  2. Addis AI writes the support-language explanation from that JSON with `chat.completions.create` and an explicit `target_language`.
  3. If that fails, fall back to `translate.create` of the English reason, then to Gemini, and log each fallback.
- Gemini must **not** write the support-language explanation in the main path. That was Voxa's quality ceiling.
- Keep Voxa's good behavior: a warm coach persona (renamed), one correction per turn, 1–3 sentence replies, session memory, reinforcement of recent weak patterns, and scenarios.
- **Help me say it:** the learner types (or later speaks) a sentence in their support language. Addis translates it to English, and Gemini makes it natural for the conversation. The learner then says it themselves.
- Voice: record locally, upload one short Opus clip (45-second cap), transcribe it with the English STT abstraction, reply text-first, and offer on-demand cached TTS. Never auto-play audio.
- Every correction creates a memory item (section 7.3).

### 7.2 Learn step by step (Duolingo approach)
Build from Duolingo's published design, not Voxa's learning module.
- **Structure:**
  - **Course:** made of sections aligned to CEFR (Intro, A1, A2, B1).
  - **Section:** made of units, each with a communication goal (for example "Introduce yourself at work").
  - **Unit:** about 6–10 levels plus a guidebook.
  - **Level:** one or more lessons.
  - **Lesson:** about 10–15 exercises and a few minutes long.
- **A linear path** with one clear next step. Completed levels can be replayed.
- **Level types:**
  - standard lesson
  - speaking roleplay (uses the Speak engine, scoped to the unit goal)
  - personal practice (from memory)
  - unit review
- **Three difficulty passes per concept**, interleaved across the unit:
  - recognition (pick or match)
  - recall (build or type)
  - production (say it)
- **Exercise types for the MVP:**
  - select the meaning
  - match pairs
  - word-bank translate (support language to English, and back)
  - fill the blank
  - listen and pick
  - type what you hear
  - speak the sentence (STT check)
- **In-lesson adaptivity:** a missed exercise returns at the end of the lesson. A streak of correct answers brings harder items.
- **Guidebooks, hints and translations** use the learner's support language. Audio for English items is pre-generated and cached, so lessons work on weak networks.
- **Authored curriculum:**
  - Lessons live as content files in `lisane/content/curriculum/`, validated by a zod schema.
  - English items are drafted with AI help and reviewed. Translations are drafted with Addis `translate` and listed for native-speaker review.
  - Content syncs into the database with an idempotent seed script.
- **Motivation:** XP per lesson, a daily goal, a streak, and celebratory feedback after exercises and lessons.

### 7.3 Shared memory (spaced repetition)
- Every word, phrase and grammar pattern the learner meets, plus every speaking correction, is a memory item with a half-life.
- Recall probability follows a forgetting curve, `p = 2^(-Δ/h)`. A correct answer increases `h`; a mistake shrinks it.
- Personal practice and daily review pick the items with the lowest predicted recall.
- The math is pure, deterministic and unit-tested.

### 7.4 Localization (next-intl)
- No hard-coded user-facing strings. Every string lives in `messages/en.json` first, with matching keys in each enabled language.
- Machine-drafted strings go into `messages/REVIEW.md` until reviewed.
- Use Noto Sans Ethiopic for Ethiopic-script languages.
- Remember the locale (`NEXT_LOCALE` cookie) and show a language picker on first launch.

### 7.5 Addis AI
- Use the `addisai` SDK only on the server, with `ADDIS_API_KEY`.
- Always pass explicit source and target languages from the registry.
- Translation input is capped at 5,000 characters, so chunk longer text.
- Cache results by `(task, language, text hash)`, and log fallbacks.

### 7.6 Low-network (main differentiator)
- The app shell, message bundles and downloaded units (content plus audio) work offline (Serwist plus Dexie).
- Lesson answers completed offline sync later.
- Every AI or speech request carries a `clientRequestId`. The server dedupes it (`ProcessedRequest`), so retries are never processed or charged twice.
- Failed sends go to an IndexedDB outbox and retry with backoff. The UI shows a queued or retrying state, never a silent failure.
- On a weak network, voice practice switches to text automatically and says so in the UI.

### 7.7 Payments (Chapa)
- Use a unique `tx_ref` for every attempt.
- Grant access only after the server calls `GET /v1/transaction/verify/:tx_ref` and confirms status, amount, currency and mode.
- Webhook: check the `x-chapa-signature` HMAC, then verify the transaction.
- Granting is idempotent on `Payment.txRef` (`PENDING` to `PAID` only once).
- Plus is a 30-day prepaid pass. Top-ups are credits.
- Limits are enforced on the server (`assertQuota`), never only in the UI.
- Prices and limits live in one config file and are placeholders until cost per minute is measured.

### 7.8 AI cost
- Log usage per feature into `DailyUsage`.
- Keep prompts and replies short.
- Cache TTS, translations and explanations.

---

## 8. Architecture rules

- **Single Next.js App Router app** with a `src/` directory:
  - `src/app/[locale]/...` for pages
  - `src/app/api/...` for route handlers (no locale prefix)
  - `src/server/` for server-only code: `ai/`, `speech/`, `addis/`, `chapa/`, `quota/`, `memory/`, `services/<feature>/`
  - `src/components/ui/` for primitives, `src/components/<feature>/` for feature UI (`speak/`, `learn/`, `practice/`, `progress/`)
  - `src/config/` for the language registry, plans and prices, and limits
  - `src/schemas/` for zod schemas (API and curriculum content)
  - `src/prompts/` for LLM prompt builders
  - `src/lib/` for client-safe helpers, and `src/lib/offline/` for Dexie, the outbox and network detection
  - `content/curriculum/` for authored lesson content
  - `messages/*.json` for UI strings
  - `prisma/schema.prisma` for the data model
- Every server-only module starts with `import "server-only";`.
- **All API keys stay server-side.** No `NEXT_PUBLIC_` secrets. Validate env with zod in `src/lib/env.ts`.
- **Route handler pattern:**
  1. authenticate (`requireAppUser`)
  2. validate input with zod
  3. check the rate limit
  4. call `assertQuota` for AI or speech work
  5. honor the idempotency key
  6. call a service
  7. return a typed DTO

  Errors use the `{ error: { code, message } }` shape.
- Business logic lives in `src/server/services/*`, not in route handlers or components.
- Prefer server components. Use `"use client"` only where interaction needs it.

---

## 9. Porting from Voxa

- **Copy, then adapt.** Read the Voxa file and its doc, copy it into the matching Lisane path, then:
  - rename Voxa, TalkBuddy, Lumi and Saba
  - replace `@talkbuddy/*` imports with `@/`
  - update APIs for the newer library versions
  - replace hard-coded `am`/`om` with the language registry
  - remove anything outside the MVP
- Port only what the current step needs.
- **Port these** (paths under `talkbuddy/apps/platform/src/` unless noted):
  - **Speaking:** `server/ai/generate-practice-reply.ts` and `server/services/practice/*` (sessions, messages, session memory, reply audio cache), `components/practice/*`, `use-recorded-voice-message.ts`, `use-practice-reply-audio-player.ts`
  - **Prompts:** `packages/prompts/src/practice/*`. The correction prompt in `packages/prompts/src/corrections/analyze-user-message.ts` is a **reference only**; it gets redesigned per section 7.1
  - **Speech:** `server/services/speech/*` (STT provider abstraction)
  - **Guardrails:** `server/services/rate-limit/*`, `server/services/ai/usage-guardrails.ts`
  - **Auth:** `lib/auth.ts`, `lib/auth-client.ts`, `lib/require-app-user.ts`
  - **Profile and onboarding:** `server/services/profile/*`, `components/profile/onboarding-page-view.tsx`
  - **UI:** `packages/ui/src/components/*`, `packages/lib/src/cn.ts`
- **Do not port:**
  - Voxa's learning module (`server/services/learning/*`, `components/learning/*`, the `Learning*` models)
  - reading or PDF
  - live voice
  - gamification internals (XP and streak are rebuilt to fit the path)

---

## 10. Code style

- TypeScript strict. No `any` without a reason.
- Name files in kebab-case and components in PascalCase.
- Write small, focused modules. Match the surrounding code's style and comment density.
- Write comments only for constraints the code can't show. No narration comments.
- Accessibility: real buttons and labels, keyboard focus, adequate touch targets (mobile-first).
- No new dependency without a clear need; mention each new dependency in the step report.

---

## 11. Verification checklist (every step)

- `pnpm typecheck` and `pnpm lint` pass.
- `pnpm build` passes for steps that touch routing, config, the service worker or the server.
- Unit tests pass for pure logic (memory math, lesson adaptivity, quota math, payment verification, idempotency, content validation).
- Prisma migration is created and applied locally when the schema changes.
- The feature is checked in the browser at mobile width, in `en` plus at least one support language, and in both light and dark mode.
- Offline-related steps are also tested with DevTools throttling ("Slow 3G" and "Offline").
- The step report says honestly what was **not** verified.

---

## 12. Roadmap (tick only after owner approval)

### Foundation
- [x] 01. Scaffold `lisane/` with `create-next-app@latest` (TypeScript, App Router, `src/`, Tailwind 4, ESLint, pnpm), plus `.env.example` and a README stub
- [x] 02. Design tokens and fonts: Tailwind 4 `@theme`, Noto Sans Ethiopic plus a Latin font, port UI primitives and `cn`
- [x] 03. next-intl: `[locale]` routing, `proxy.ts`, `messages/en.json`, locale cookie, language switcher
- [x] 04. Language registry (`src/config/languages.ts`), Addis-drafted `am`/`om` messages, `messages/REVIEW.md`
- [x] 05. App shell: mobile layout, bottom navigation (Learn, Speak, Practice, Progress, Profile), placeholder `Mascot`, empty pages, and the theme switch (System, Light, Dark) saved in a cookie so the page never flashes the wrong theme
- [ ] 06. Env validation (`src/lib/env.ts`) and the `server-only` setup

### Data and auth
- [ ] 07. Prisma (latest stable) with a hosted Postgres connection and base auth models
- [ ] 08. Better Auth port: email plus Google, login and signup pages, `requireAppUser`
- [ ] 09. `UserProfile` and onboarding: goal, English level, support language, daily goal
- [ ] 09b. Deploy a staging environment (host and hosted Postgres chosen with the owner), so every later step is tested on real phones and networks

### AI and language core
- [ ] 10. Gemini client on the latest `@google/genai`, rate limiter, usage guardrails
- [ ] 11. Addis AI client: `translate` and `chat` with registry-driven languages, caching and fallbacks

### Speak anytime
- [ ] 12. Speaking sessions: text chat, messages, coach reply (Voxa prompt ported and renamed)
- [ ] 13. Correction pipeline v2: Gemini English judgment, Addis support-language explanation, correction card
- [ ] 14. Help me say it: support-language input to natural English
- [ ] 15. STT abstraction plus recorded voice message (Opus recorder, 45-second cap)
- [ ] 16. Reply TTS with cache, plus a "Play voice" button
- [ ] 17. Scenarios (self-introduction, job interview, workplace, university) and the session review page

### Learn step by step
- [ ] 18. Curriculum content schema (zod), `content/curriculum/` layout, validator script, first unit authored
- [ ] 19. Curriculum and progress models, idempotent content sync, path API
- [ ] 20. Path screen: sections, units, level nodes (locked, current, done), unit guidebook in the support language
- [ ] 21. Lesson player plus exercises batch 1: select meaning, match pairs, word-bank translate (both directions), fill the blank
- [ ] 22. Exercises batch 2: listen and pick, type what you hear, speak the sentence; pre-generated cached audio
- [ ] 23. In-lesson adaptivity (missed items return, harder items on a streak), lesson complete screen, XP
- [ ] 24. Speaking roleplay level using the Speak engine, scoped to the unit goal
- [ ] 25. Author the rest of the MVP section's units (content-only step, translations listed for review)

### Memory, practice and progress
- [ ] 26. Memory model: half-life spaced repetition for lesson items and speaking corrections, plus unit tests
- [ ] 27. Personal practice level and daily review built from memory
- [ ] 28. Streak, daily goal and the progress page (minutes spoken, lessons, mistake breakdown, strong and weak items)

### Low-network
- [ ] 29. Serwist PWA: manifest, icons, app shell and message precache, install prompt
- [ ] 30. Dexie: downloaded units (content plus audio), offline lesson completion with later sync, local speaking history
- [ ] 31. Outbox plus `clientRequestId` idempotency (`ProcessedRequest`) with retry UI
- [ ] 32. Network-quality hook: automatic text-first fallback, banner, streaming replies with resume

### Monetization
- [ ] 33. Usage, entitlement, credit and payment models, plus `assertQuota` on all AI and speech routes
- [ ] 34. Chapa checkout, callback, return page and verify (test mode)
- [ ] 35. Chapa webhook with signature check, idempotent granting, plans page and the limit-reached flow

### Demo readiness
- [ ] 36. Landing page (localized)
- [ ] 37. Demo script (`docs/demo-script.md`) and an end-to-end QA pass. Demo flow: install the PWA, choose the support language, do a path lesson, speak in a job-interview scenario and get a correction explained in Afaan Oromo, see the mistake return in practice, throttle the network live, hit the free limit and pay with Chapa

---

## 13. Open questions (ask the owner, don't decide alone)

- Hackathon name and judging theme
- Mascot name and art
- Coach persona name (Voxa's coach gets renamed)
- MVP curriculum scope: how many units, and which themes (proposed: Intro section focused on job seekers, such as introducing yourself, daily routine, at work and interview basics)
- Free-tier limits: AI speaking only, or path lessons too (lessons are mostly static and cheap)
- Final prices (after measuring cost per conversation minute)
- Native-speaker reviewers for Amharic and Afaan Oromo text
- Hosting target and which hosted Postgres to use
