# Swap SvelteKit adapter-static for adapter-cloudflare

The app currently builds to a static SPA served as Workers assets. Social features need authenticated server routes (`+server.ts` for `/api/...`), `+hooks.server.ts` for CF Access JWT verification, `event.locals` for per-request user injection, and direct D1 binding access — none of which work under `adapter-static`. We swap to `@sveltejs/adapter-cloudflare` so the app compiles to a Worker that runs at request time and can front D1.

**Status:** accepted

**Considered Options.** Keep `adapter-static` and ship a *second* Worker as API-only behind the SPA. Rejected — two deployments, two auth-verify boundaries, two wrangler configs, D1 binding accessible only from the API worker. The single-adapter swap keeps one deployment and one source of truth for auth.

**Consequences.** Root route `/` can no longer be prerendered — authenticated routes render at request time. Cold start cost (tens of ms first request) irrelevant for ~50-user alpha. PWA service worker generation unaffected (vite-plugin-pwa stays build-time). Local D1 via `wrangler d1 migrations apply --local` becomes a one-time dev setup step.