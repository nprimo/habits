# Cloudflare Access as the alpha auth gate; email as the User identity

For the alpha cohort (2 emails), we use Cloudflare Access in front of the app:Google IdP, allow-list of two emails. Access verifies identity and emits a signed JWT in the `CF-Access-Jwt-Assertion` header on every request. A SvelteKit `+hooks.server.ts` verifies the JWT against CF's public keys and reads `email` from the payload; the email is the lookup key into the `users` table (unique). No `cf_sub` column is stored — CF Access's opaque ID is discarded, since it will be orphaned once we swap to direct Google OAuth after alpha.

App code treats every authenticated request as `plan: 'paid'`. "Who is in alpha" is defined exclusively by the CF Access allow-list — there is no `plan: 'alpha'` field, so no code branches on alpha. Removing a name from the allow-list ends their alpha access; adding a name grants it. When the alpha ends and we switch to Google OAuth + Stripe (ADR-0003), the same email keys continue to identify the same User rows.

**Status:** accepted

**Considered Options.** Add a `plan: 'free' | 'paid' | 'alpha'` tier with `alpha` as a real plan. Rejected — every plan-gated branch would gain a permanent `|| plan === 'alpha'` clause; "alpha" is a cohort tag, not a SaaS plan, and the cohort will end. CF Access allow-list already restricts access to the app, so cohort membership lives where it belongs (the auth boundary), not where it doesn't (a domain enum).

**Consequences.** Identity is email-stable across the alpha → public swap: CF Access and direct Google OAuth both surface the user's email, so a User row created during alpha is reused without remapping when auth swaps. Future Stripe `plan` flips to `paid` only after payment is verified — alpha cohort's `plan` becomes whatever we choose to comp them to at switchover (likely `paid` indefinitely, or `free` requiring upgrade). The CF Access JWT public-key fetch caches keys server-side per the CF docs; cf_sub is not persisted.