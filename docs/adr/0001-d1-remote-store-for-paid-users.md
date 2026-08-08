# D1 as the remote store for paid-user data

Social/cooperative features need a shared, multi-user data store; the existing sql.js/IndexedDB is per-browser and has no concept of users. We pick Cloudflare D1 (SQLite on Cloudflare Workers) because the current schema is already SQLite — most queries port with minimal rewrite — and the project is already deployed on Cloudflare Workers. Rejected: Workers KV (no SQL, forces schema rethink), Durable Objects (per-habit transactional coordination is overkill for v1), external Postgres via Hyperdrive (more power but more ops overhead).

**Status:** accepted

**Consequences.** Free users keep using sql.js/IndexedDB locally. Paid users' solo + cooperative habits live in D1. Solo habits migrate local→remote on upgrade and remote→local on downgrade; cooperative habits archive on remote on downgrade and revive on re-subscribe.