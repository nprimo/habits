# Server-first with optimistic UI, no local cache for paid users

Paid users have no client-side database. Workers + D1 is the single source of truth; the UI holds an in-memory cache and optimistically renders the last-known state while waiting for network responses. The app requires network to load or write — no offline writes for paid users.

**Status:** accepted

**Considered Options.** Hybrid local-first (keep IndexedDB as a cache synced with D1) — rejected because conflict resolution, sync state, and two-sources-of-truth add complexity disproportionate to the user count we expect in v1. Server-first with optimistic UI wins on simplicity and correctness.

**Consequences.** Free users keep working offline in IndexedDB (existing PWA behavior preserved). Paid users get a different runtime model — that asymmetry is intentional and lives behind the plan boundary, so a user never experiences both simultaneously. ADR-0001's migration flow crosses that boundary as a one-shot operation, not a steady-state hybrid.