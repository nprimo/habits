# OAuth via Google and GitHub for User identity

Users authenticate with third-party OAuth (Google first, GitHub second). No password storage on our side. Sessions live in signed cookies on the Workers side.

**Status:** accepted

**Considered Options.** Email magic link (self-hosted, but requires transactional email infra and adds a step the user must leave the app for); rolled-own passwords (rejected — abuse surface, breach risk, no value we can't get from OAuth).

**Consequences.** A User is only materialized after first OAuth login — we never store their raw credential. The entity that owns a Habit is the OAuth-authenticated User. Invitees must complete OAuth at least once before they appear as a member of a Habit; until then an invite is a pending token tied to an email address, not a User row.