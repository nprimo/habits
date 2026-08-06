# HabitStore interface with two implementations behind a factory

Data access goes through one `HabitStore` interface. Two implementations: `local.ts` (sql.js, IndexedDB, today's behavior preserved for free / unauthenticated users) and `remote.ts` (D1 RPC for paid users). An `index.ts` factory (`getStore(ctx)`) picks the implementation from `ctx.user.plan` — paid → remote, otherwise local. Pages and routes import `getStore` once and never branch on plan.

Splitting (vs. branching inside one module) keeps each implementation honest about its I/O: `local` stays synchronous sql.js, `remote` is async fetch against D1. The interface must be async (Promise-returning on all mutating ops) to accommodate `remote` — local impls wrap sql.js calls in `Promise.resolve(...)`. Tests inject a fake `ctx` instead of mocking per-call-site.

**Status:** accepted

**Considered Options.** One module with `if (ctx.user?.plan === 'paid')` branches at each function. Rejected — glues two I/O models together, harder to test, and the branch would need replication at ~30 call sites. A split keeps each impl readable and matches the "clean code, not glue" goal.

**Consequences.** The interface is async throughout — existing sync call sites in `+page.svelte` become `await`ed. `logEntry`, `getScore`, `getPeriodBlocks` move behind `HabitStore`. Free-tier (localhost / unauth) keeps working via `local.ts`; the sql.js / IndexedDB surface shrinks to that file only.