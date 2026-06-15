# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Katuu is a location-based social app ("connect with people at the same place, at the same time, with shared interests"). It's a React + TypeScript + Vite SPA, packaged as a PWA and as an Android app via Capacitor, backed by Supabase (Postgres + Auth + Realtime + Storage + Edge Functions).

All UI copy, code comments, and commit messages in this repo are in Portuguese (pt-BR) — follow that convention.

## Commands

```bash
npm run dev          # Vite dev server on port 8080
npm run build         # Production build
npm run build:dev     # Development-mode build
npm run vercel-build   # Build then copy dist/landing.html -> dist/index.html (static marketing site deploy)
npm run lint           # ESLint over the whole repo
npm run test           # Run vitest once (CI mode)
npm run test:watch     # Run vitest in watch mode
```

Run a single test file:
```bash
npx vitest run src/test/interactionRules.test.ts
```

There is no separate typecheck script; `tsconfig` is intentionally loose (`strict: false`, `strictNullChecks: false`, `noImplicitAny: false`, unused vars/params allowed).

Path alias: `@/*` → `src/*` (configured in `vite.config.ts`, `tsconfig.*.json`, and `vitest.config.ts`).

## Architecture

### High-level structure

- `src/App.tsx` — routing root. Wraps everything in `QueryClientProvider` → `AuthProvider` → `BrowserRouter` → `ConversationsProvider` → `RealtimeProvider` → `TooltipProvider`. Pages are lazily loaded. The route table branches on `useAuth()`: authenticated users get `/home`, `/profile`, `/waves`, `/chat`, `/location`, `/onboarding`, `/tutorial`, etc.; unauthenticated users get `/auth` and the splash screen. Two custom error boundaries (`AppErrorBoundary`, `LazyErrorBoundary`) handle render crashes and chunk-load failures (with a one-shot auto-reload for stale WebView caches after deploys).
- `src/contexts/` — `AuthContext` (Supabase session/user), `ConversationsContext`, `RealtimeContext` (single shared Supabase Realtime channel for `user_blocks`/`user_mutes`, fanning out to listeners via `addListener` — avoids duplicate channels across hooks).
- `src/hooks/` — most business logic lives here as hooks consumed by pages. `src/hooks/presence/` is a sub-module with focused sub-hooks (`usePresenceState`, `usePresenceGPS`, `usePresenceTimer`, `usePresenceLifecycle`) composed by `usePresence.ts`.
- `src/pages/` — route-level components (`Home`, `Profile`, `Waves`, `Chat`, `Location`, `Onboarding`, `Auth`, etc.), generally orchestrating multiple hooks.
- `src/components/` — `ui/` is shadcn/ui (Radix-based, do not hand-edit generated primitives beyond what's needed); feature folders (`home/`, `chat/`, `auth/`, `profile/`, `location/`, `onboarding/`, `tutorial/`, `layout/`) hold app-specific components.
- `src/integrations/supabase/` — `client.ts` (Supabase client, reads `VITE_SUPABASE_*` env vars) and `types.ts` (generated DB types — `Tables<'...'>` etc.).
- `src/config/presence.ts` — tunable constants for the presence system (radii, durations, GPS thresholds) plus Haversine distance helpers.
- `src/lib/interactionRules.ts` — canonical, pure-function source of truth for the wave/chat/block/mute interaction state machine (see below).
- `supabase/migrations/` — SQL migrations (Postgres functions, triggers, RLS). `supabase/functions/` — Edge Functions (`search-places`, `send-fcm`, `send-push`, `cleanup-expired-presences`, `process-notification-queue`).
- `DB_4.0.3.md` — generated dump of the current DB schema (tables, functions, triggers); useful as a reference for available RPCs and table shapes without querying Supabase directly.
- `android/` — Capacitor Android project (generated/managed by `npx cap sync`; don't hand-edit generated `build/` output).

### Backend-first / RPC pattern

Business-critical logic (validation, state transitions, rate limits, cooldowns) lives in Postgres functions (`supabase/migrations/*.sql`) called via `supabase.rpc(...)`, not duplicated client-side. Examples: `send_wave`, `accept_wave`, `ignore_wave`, `activate_presence`, `end_presence_cascade`, `create_temporary_place`, `block_user`/`mute_user`, `submit_report`. Client hooks call the RPC, then map backend error codes (e.g. `WAVE_COOLDOWN`, `ACCEPT_WAVE_EXPIRED`) to user-facing Portuguese messages — see `mapSendWaveError`/`mapAcceptWaveError` in `src/hooks/useWaves.ts` for the pattern. When adding a new interaction/validation rule, prefer adding/modifying a Postgres function + migration over client-side logic.

### Presence system

"Presence" = a user actively checked in at a place. Central concepts in `src/config/presence.ts` and `src/types/presence.ts`:
- A single radius (`PRESENCE_RADIUS_METERS`, 150m) governs entry, search and validation; `SEARCH_RADIUS_METERS` (500m) is used for discovering nearby places.
- Presence has a max duration (`PRESENCE_DURATION_MS`, 2h) and can be renewed once (`renewPresence`, enforced server-side via `enforce_renewal_limit`).
- **GPS-based auto-exit is intentionally disabled** (`GPS_EXIT_ENABLED = false`, decided product behavior since jun/2026 — see the comment block in `src/config/presence.ts` before changing this). GPS is only used on entry, to confirm the user is within range via `confirm_presence`.
- Three logical states (`PresenceLogicalState` in `src/types/presence.ts`): `active`, `suspended` (transient — background/revalidation), `ended` (only ever set by explicit human action — manual exit or timeout). Don't conflate technical/lifecycle interruptions with `ended`.
- `usePresence()` composes the sub-hooks in `src/hooks/presence/` and is the single entry point pages should use.

### Interaction state machine

`src/lib/interactionRules.ts` is the **single canonical implementation** of the wave/chat/mute/block interaction state between two users at a place (`InteractionState` enum + `getInteractionState`/`deriveFacts`/`canWave`/`canAcceptWave`). It must not be duplicated — UI components (e.g. `PeopleList`) and hooks (`useWaves`, `useInteractionData`) derive `InteractionFacts` from `get_interaction_context` RPC data and pass them through these pure functions. When changing interaction rules, update this file (and its tests in `src/test/interactionRules.test.ts`) first.

### Realtime

Realtime subscriptions are consolidated to avoid duplicate channels:
- `RealtimeContext` owns one channel for global `user_blocks`/`user_mutes` changes, fanned out via `addListener`.
- Per-place feeds (e.g. `usePeopleNearby`) use their own channel scoped to `place_id`, debounced (~300ms) to coalesce bursts. Note RLS quirks documented inline (e.g. `ativo=false` UPDATEs on `presence` are suppressed by RLS, so exits are detected via a `places` UPDATE side-channel instead).

### Versioning

`src/version.ts` is the single source of truth for the app version shown in the UI. Keep it in sync with `android/app/build.gradle` (`versionName`/`versionCode`) and the corresponding git tag when bumping.

### Build/deploy notes

- `vite.config.ts` marks Capacitor packages (`@capacitor/*`, `@capgo/capacitor-social-login`) as Rollup `external` for the web build — they're only resolved in the native Android build via Capacitor.
- PWA is configured via `vite-plugin-pwa` (`autoUpdate` registration, Workbox caching for fonts/images/static assets).
- The web deploy (Vercel) serves a static landing page at `/` (`public/landing.html`) via `vercel.json` rewrites and the `vercel-build` script; the actual app is reached through other routes/the Android app.

### Logging

Use `logger` from `src/lib/logger.ts` (`debug`/`info`/`warn` are no-ops outside `import.meta.env.DEV`; `error` always logs). Avoid raw `console.*` for anything except genuine errors — production builds also strip `console`/`debugger` via esbuild.
