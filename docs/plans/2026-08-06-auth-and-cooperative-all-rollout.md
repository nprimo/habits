# Rollout Plan: Auth + Cooperative-All Goals

Three phases, each with explicit goals and verification. No phase starts until the previous passes its checks. No code touches source until the phase's ADRs (already written) are acknowledged.

ADRs of record: 0001 (D1), 0002 (server-first), 0003 (OAuth future), 0004 (adapter swap), 0005 (CF Access alpha + email identity), 0006 (HabitStore interface).

---

## Phase 0 — Infra

### Goals

- App compiles to a Cloudflare Worker (not a static SPA).
- D1 binding available in server code.
- Authenticated requests carry a verified user identity (`event.locals.user`).
- Free / unauthenticated path keeps working (existing sql.js habits load from IndexedDB).
- Local dev runs against a local D1 instance.

### Tasks

| # | Task | Files |
|---|---|---|
| 0.1 | Create Cloudflare Access app on `habits.<subdomain>.workers.dev` — Google IdP, allow-list 2 emails | CF dashboard |
| 0.2 | Create D1 database `habits-prod`; note binding id | CF dashboard |
| 0.3 | Add `d1_databases` binding to wrangler config | `wrangler.jsonc` |
| 0.4 | Swap `@sveltejs/adapter-static` → `@sveltejs/adapter-cloudflare` | `package.json`, `svelte.config.js` |
| 0.5 | Add `+hooks.server.ts`: verify CF Access JWT, populate `event.locals.user = { email, plan: 'paid' }` | `src/hooks.server.ts` (new) |
| 0.6 | Add `app.d.ts` typing for `App.Locals` | `src/app.d.ts` |
| 0.7 | Disable prerender for authenticated routes; keep prerender for `/login` static page if any | route `+page.ts` files |
| 0.8 | Local D1 setup: `wrangler d1 create habits-local --local`, migration scaffolding | `migrations/` (new) |
| 0.9 | Add `/api/health` route returning `{ ok: true, user: event.locals.user?.email ?? null }` | `src/routes/api/health/+server.ts` (new) |

### Verification (done when all pass)

1. `pnpm build` — succeeds; output is a Worker bundle (not `build/` static files only).
2. `pnpm dev` — local server starts; `wrangler d1 migrations apply --local` runs cleanly.
3. `curl http://localhost:5173/api/health` — returns `{ ok: true, user: null }`.
4. `pnpm deploy` — app live on `habits.<subdomain>.workers.dev`.
5. **CF Access wall** — visit app URL in fresh browser; Cloudflare Access login appears.
6. **Allow-listed email** — login with one of the 2 allow-listed emails; land in app.
7. **JWT verification** — `curl -H "CF-Access-Jwt-Assertion: <jwt>" https://habits.<subdomain>.workers.dev/api/health` returns `{ ok: true, user: "<allow-listed-email>" }`.
8. **Rejected JWT** — `curl https://habits.<subdomain>.workers.dev/api/health` without header (direct, bypassing Access) returns `{ ok: true, user: null }`; with a tampered JWT returns 401.
9. **Free path preserved** — kill network, run `pnpm dev`, app loads; existing solo habits render from IndexedDB as today (no auth enforced in dev).
10. **Existing tests still green** — `pnpm test` passes; no behavioral regression in `db.test.ts` / `score.test.ts`.

### Out of scope for Phase 0

- D1 schema for users / habits / goals / memberships (Phase 1).
- Any UI change.
- Migration of existing IndexedDB data (skipped per ADR-0005).

---

## Phase 1 — User entity + remote store

### Goals

- Authenticated request resolves to a `User` row in D1 (lazy-created on first sight of an email).
- `HabitStore` interface defined; `local.ts` and `remote.ts` impls both compile; `index.ts` factory dispatches by `ctx.user.plan`.
- Existing solo-habit data model works against D1: create, read, log, score, period blocks, archive — all CRUD behaving as today, just backed by D1 for paid users.
- App loads habits from D1 for authenticated users; from IndexedDB for unauthenticated.
- No cooperation features exposed in UI yet.

### Tasks

| # | Task | Files |
|---|---|---|
| 1.1 | D1 migration `0001_users.sql`: `users (id TEXT PK, email TEXT UNIQUE NOT NULL, home_tz TEXT, plan TEXT NOT NULL DEFAULT 'paid', created_at TEXT NOT NULL)` | `migrations/0001_users.sql` |
| 1.2 | `+hooks.server.ts` extended: verify JWT → query user by email → if absent insert → attach `User` to `event.locals.user` | `src/hooks.server.ts` |
| 1.3 | D1 migration `0002_habits.sql`: port today's schema, add `home_tz TEXT`, keep `goals` versioned, add `cooperation_mode TEXT NOT NULL DEFAULT 'solo'` to `goals`, add `status TEXT NOT NULL DEFAULT 'active'` to `goals` (`forming|active`) | `migrations/0002_habits.sql` |
| 1.4 | D1 migration `0003_memberships.sql`: `memberships (habit_id, user_id, role, created_at)`, `invites (id, goal_id, email, role, status, created_at, accepted_at)` — schema only, no code uses them yet | `migrations/0003_memberships.sql` |
| 1.5 | Define `HabitStore` interface — every public function from today's `db.ts` becomes a method returning `Promise<T>` | `src/lib/db/types.ts` (new) |
| 1.6 | `local.ts`: move sql.js code from current `db.ts` into `local.ts`; wrap returns in `Promise.resolve` | `src/lib/db/local.ts` (new) |
| 1.7 | `remote.ts`: D1-backed impl — fetch `/api/habits`, `/api/habits/:id/log`, etc. | `src/lib/db/remote.ts` (new) |
| 1.8 | `index.ts`: `getStore(ctx)` factory returning `local.ts` or `remote.ts` based on `ctx.user?.plan` | `src/lib/db/index.ts` (new) |
| 1.9 | API routes: `/api/me`, `/api/habits` (GET/POST), `/api/habits/:id` (PUT/DELETE), `/api/habits/:id/log` (POST/DELETE), `/api/habits/:id/archive`, `/api/habits/:id/unarchive`, `/api/habits/:id/reorder`, `/api/habits/:id/period-blocks`, `/api/habits/:id/log-entries` | `src/routes/api/.../+server.ts` (new) |
| 1.10 | `+layout.svelte`: replace `initDB()` with `fetch('/api/me')`; if 401 → set `ctx.user = null`, load via `local.ts`; if 200 → set `ctx.user`, load via `remote.ts` | `src/routes/+layout.svelte` |
| 1.11 | `+page.svelte` and all components: replace sync `db.ts` calls with `await getStore(locals).<method>(...)` | `src/routes/+page.svelte`, `src/lib/components/*.svelte` |
| 1.12 | `server/db.ts`: D1 query helpers — `queryAll`, `queryOne`, `run` — used by all `/api` routes | `src/lib/server/db.ts` (new) |

### Verification

1. `wrangler d1 migrations apply habits-prod --remote` — all three migrations apply cleanly.
2. **User lazy-create** — first authenticated request from allow-listed email inserts a row in `users`. Verify via `wrangler d1 execute habits-prod --command "SELECT * FROM users"`.
3. **Second email same flow** — login as second allow-listed email; second `users` row appears.
4. **Habit create via D1** — authenticated, create habit "Drink water 1/day" in UI; `SELECT * FROM habits` in D1 shows the row; `SELECT * FROM goals` shows one versioned goal.
5. **Habits persist across sessions** — log out, log back in, habit is still there.
6. **Log entries hit D1** — log today; `SELECT * FROM log_entries WHERE habit_id = ?` shows the row; `logged_at` is TZ-aware ISO 8601 with author's offset.
7. **Score computes from D1** — backfill 5 days of logs via UI; score matches what sql.js would have produced for the same inputs (manual sanity-check or direct query).
8. **Period blocks render** — overview tab shows the 10-block grid for D1-backed habits.
9. **Archive/unarchive/delete work** — exercise all three; verify in D1.
10. **Unauthenticated free path** — clear auth cookie in dev; app falls back to `local.ts`, IndexedDB loads, solo habits work end-to-end as before.
11. **Factory unit test** — `getStore({ user: null })` returns `localStore`; `getStore({ user: { plan: 'paid' } })` returns `remoteStore`.
12. **No new tests broken** — existing `db.test.ts` and `score.test.ts` continue passing against `local.ts`.
13. **No cooperation UI** — `HabitForm.svelte` still shows only solo goal fields; no mode selector, no email-invite field.

### Out of scope for Phase 1

- Any cooperation-mode UI (mode stays `solo` for all habits the user creates).
- Invites or memberships used by code (schema only).
- Plan-gating logic (alpha has no plan check needed; everyone authenticated is paid per ADR-0005).
- Migration of existing IndexedDB data.

---

## Phase 2 — Cooperative-All Goal

### Goals

- Owner can transform a solo habit into a cooperative-all habit by inviting ≥1 participant via email.
- Invited user sees pending invite on Today; accepting promotes invite → membership; when all invites accepted, goal transitions `forming → active` (atomic with previous goal archive — no scoring gap per ADR of Q13 lifecycle).
- Each participant logs independently in their own TZ (cooperative-all framing per CONTEXT.md).
- Per-participant cap enforced server-side.
- Shared Score recomputes per period boundary (period final only after latest framing TZ rolls past its boundary).
- UI shows per-participant progress alongside shared score.
- `/shared` route shows habits where user has `observer` role.

### Tasks

| # | Task | Files |
|---|---|---|
| 2.1 | `+hooks.server.ts`: enforce plan-gate — only `plan === 'paid'` may call `/api/habits/:id/transform` and `/api/invites` routes; 402 otherwise | `src/hooks.server.ts` |
| 2.2 | API `POST /api/habits/:id/transform` — body `{ mode, targetCount, period, invitees: [{ email, role }] }`. With `mode='cooperative-all'`: validate `invitees` non-empty, all `role='participant'`; archive current goal (`to=now`); insert new goal with `status='forming'`, `cooperation_mode='cooperative-all'`, `home_tz` from owner; insert `invites` rows (one per participant email); do **not** archive old goal until the new goal becomes active (per Q13 decision B). **Correction:** old goal stays active and accruing; only when the forming goal activates do we swap (close old `to=now`, mark new `active` from `now`). | `src/routes/api/habits/[id]/transform/+server.ts` (new) |
| 2.3 | API `GET /api/invites` — list invites pending for `event.locals.user.email` | `src/routes/api/invites/+server.ts` (new) |
| 2.4 | API `POST /api/invites/:id/accept` — if invitee's email matches the authed user: set invite `status='accepted'`; insert `memberships` row (habit_id from invite.goal_id → habit, user_id = authed user, role from invite); check if all invites for that goal have `status='accepted'` — if yes: set goal `status='active'`, set `from=now`, set previous goal `to=now` (atomic transaction). | `src/routes/api/invites/[id]/accept/+server.ts` (new) |
| 2.5 | API `POST /api/invites/:id/decline` — set `status='revoked'`; if all invites revoked or accepted-with-quorum-failed → owner gets to reinvite or cancel; for Phase 2 simplest: declined invite blocks goal activation; owner can re-issue. (Revisit lifecycle in Phase 3.) | `src/routes/api/invites/[id]/decline/+server.ts` (new) |
| 2.6 | `logEntry` server-side: enforce cap per cooperation mode — `solo` and `cooperative-any` shared pool cap `targetCount`; `cooperative-all` per-participant cap `targetCount`. Reject 409 with descriptive error on cap exceeded. Also reject if goal status is `forming` (no logging yet) or habit archived. | `src/routes/api/habits/[id]/log/+server.ts` |
| 2.7 | `getScore` server-side: walks periods since habit creation (or last reactivation); per period: for cooperative-all, fetch each participant's log count in their own framing TZ; period met only when all participants ≥ targetCount; +1/-1 per period; period is final only after the latest framing TZ rolls past its boundary (impl detail: max +14, so check `now ≥ period_end + 14h + buffer`). | `src/lib/server/score.ts` (new) |
| 2.8 | `getProgress` server-side: for cooperative-all, returns `{ perParticipant: [{ userId, count, isComplete }], habitComplete: boolean }` instead of a single number. Keep `solo` returning single number; `cooperative-any` returns shared pool count. | `src/lib/server/progress.ts` (new) |
| 2.9 | `HabitForm.svelte`: add Cooperation selector (solo / cooperative-any / cooperative-all — cooperative-any disabled in Phase 2 if you want to ship one mode at a time). Email-invite field appears when mode ≠ solo; supports `+ add invitee` with role picker (participant only for Phase 2; observer will be Phase 3). | `src/lib/components/HabitForm.svelte` |
| 2.10 | `+page.svelte` Today view: section "Pending invites" — list of incoming invites with Accept/Decline buttons. | `src/routes/+page.svelte` |
| 2.11 | `+page.svelte` overview: for cooperative-all habits, show per-participant progress (`You 1/2, Alex 0/2`) alongside shared score. | `src/routes/+page.svelte`, `HabitCard.svelte` |
| 2.12 | `/shared` route — read-only view; shows habits where `memberships.role='observer'` for the authed user. Observers see goal, progress, score; no log controls. | `src/routes/shared/+page.svelte` (new) |
| 2.13 | Tests — `score.test.ts` extended: cooperative-all period judging (all-met → +1; one miss → -1); TZ framing (Tokyo vs London participants); cap shape (per-participant); forming/active transition (no scoring during forming, no scoring gap on transition). | `src/lib/server/score.test.ts` (new) |
| 2.14 | Tests — `invites.test.ts`: invite lifecycle pending → accepted; quorum triggers goal activation; previous goal archived at activation instant. | `src/routes/api/invites/invites.test.ts` (new) |
| 2.15 | Tests — `transform.test.ts`: solo → cooperative-all versions goal; old goal visible until new becomes active; reject transform with zero invitees; reject transform on archived habit; reject if not owner. | `src/routes/api/habits/[id]/transform/transform.test.ts` (new) |

### Verification

1. **Transform into forming** — owner selects cooperative-all, adds friend's email, saves; D1 shows: old goal `to IS NULL` (still active, still scoreable), new goal `status='forming'`, `invites` row `status='pending'`.
2. **Invitee sees invite** — friend logs in (second allow-listed email); "Pending invites" section shows the invite with owner name and habit name.
3. **Accept triggers activation** — friend clicks Accept; in the same request, goal transitions `forming → active`, previous goal `to=now`, `memberships` row inserted. Verify via direct D1 query.
4. **No scoring gap** — immediately after activation, scores for both owner and friend are unchanged from before transform (old goal's score preserved up to activation instant, new goal starts accruing from now).
5. **Independent logging** — owner logs in own TZ; friend logs in own TZ; entries stored with each author's offset.
6. **Per-participant cap** — owner logs targetCount entries; try to log targetCount+1 → 409 "Cap reached". Friend can still log their own targetCount.
7. **Per-participant progress visible** — habit card shows `You 1/1, Alex 0/1` for a 1/week cooperative-all.
8. **Score reflects collective outcome** — period rolls past all framing TZs: if both met target → +1; if either missed → -1; both users see the same score.
9. **Pending invite while friend inactive** — owner transforms; friend has not yet logged in; invite stays pending forever (no expiry in Phase 2); owner can see "waiting on Alex" state in UI.
10. **Observer flow** — Phase 2 ships the schema and `/shared` route scaffold; smoke-test that an observer row (inserted manually via D1 if Phase 3 not built) renders read-only. Full observer invite UI deferred to Phase 3.
11. **Plan gate** — manually flip one user's `plan` to `free` in D1; transform endpoint returns 402; logging on existing cooperative-all habit still works (gate is on *host* capability, not on participating — per Q10).
12. **Cooperative-any disabled** — UI selector offers only `solo` and `cooperative-all` in Phase 2; `cooperative-any` hidden (ships Phase 3+).
13. **`pnpm test` green** — new tests pass; existing solo tests still pass (free path unaffected).
14. **`pnpm check` clean** — no type errors.
15. **Manual end-to-end with friend** — both allow-listed users complete a 1-week cooperative-all goal; both see shared score increment at period boundary.

### Out of scope for Phase 2

- `cooperative-any` mode (Phase 3).
- Observer invite UI (Phase 3 — `/shared` route exists but owner can't yet invite observers through UI).
- Invite expiry / revoke lifecycle beyond accept and decline.
- Migration of IndexedDB data (deferring per ADR-0005).
- Stripe / payment integration (alpha uses CF Access allow-list; everyone authenticated is `plan='paid'`).
- Direct Google OAuth (CF Access fronts Google IdP for alpha; swap happens post-alpha).

---

## Phase 3+ (parked, not in this plan)

- `cooperative-any` mode (shared pool cap, owner's homeTz framing).
- Observer invites through UI (today: schema + route exist).
- Invite revoke / expire / re-invite lifecycle.
- Stripe payment integration → `plan` becomes Stripe-validated.
- Direct Google OAuth swap (CF Access removed; OAuth handled in-app per ADR-0003).
- Local→D1 migration tool (`/api/migrate` import flow) for public paid users with existing IndexedDB streaks.
- Multi-device sync for paid users (optimistic UI conflict UX).
- Notifications: invite-sent email, invite-accepted toasty, weekly observer digest.

---

## Cross-phase rules

- No phase starts until the previous phase's Verification list is fully checked.
- Verify steps run against the deployed Worker on `habits.<subdomain>.workers.dev`, not just local dev.
- ADRs are append-only; if a decision changes, write a superseder ADR rather than editing an existing one.
- CONTEXT.md is the single source of truth for glossary; if a new term surfaces during implementation, add it inline rather than parking it in code comments.
- Existing `db.test.ts` and `score.test.ts` must stay green across all phases — they guard the free / local path.