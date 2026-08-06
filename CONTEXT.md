# Domain Glossary

## User
The human actor who owns or participates in Habits. Identical to their login account — one human, one User. Must be authenticated to interact with any shared/cooperative Habit.

A User carries a **plan**: `free` or `paid`. Plan gates *host* capabilities — creating cooperative habits, transforming cooperation mode, inviting participants or observers. Invitees (participants, observers) can be free; only the owner pays. Lapsing payment archives the owner's cooperative habits on the remote store (frozen, hidden, no logging); solo habits migrate back to local storage and keep working. Re-subscribing unarchives cooperative habits with no data loss.

## Habit
A behavior one or more Users want to build (e.g., "drink enough water", "vacuum the house").

## Membership
The link between a User and a Habit. Each Membership carries a **role**:

- **owner** — the User who created the Habit. Can edit goal, invite, archive, delete. In cooperative habits, the owner is also a participant (logs entries).
- **participant** — can log Log Entries toward the Habit's Goal. Only exists on cooperative habits.
- **observer** — can see the Habit, its Goal, and progress; cannot log. Used for both accountability (support) and challenge (compare scores) — motivation lives in UI framing, not the role.

A Habit has exactly one owner. Solo habits have only an owner. Cooperative habits have one owner plus one or more participants; observers may be attached to any habit regardless of mode.

## Invite
An owner-issued request for a User to join a Habit as participant or observer. Identified by email (or User ID if the invitee already exists). Carries a role and lives on the forming Goal. When every Invite on a cooperative goal is accepted, the goal becomes `active`.

## Goal
A target frequency for a Habit over a period (e.g., "1/day", "2/week"). Composed of:

- **target count** — how many times (integer ≥ 1)
- **period** — the time window (`daily` or `weekly`)
- **cooperation mode** — how participants' Log Entries combine toward the target: `solo`, `cooperative-any`, or `cooperative-all`

A Goal has a **lifecycle**: `forming` | `active`. A newly-created cooperative goal enters `forming` and stays there until every invited participant accepts (see Invite). The previous Goal remains `active` (and keeps accruing Score) until the new one becomes `active` — no scoring gap during invite acceptance. A solo goal is `active` immediately on creation.

Goals are **versioned**: changing a Habit's goal archives the old one (sets `to` timestamp) and creates a new current goal (`to` = null). Score recomputation uses the historical goal active during each past period — retroactive consistency.

## Period
The time window over which Progress is measured and compared to the Goal's target count. Two types:

- **daily** — a single calendar day (midnight to midnight in the framing timezone)
- **weekly** — Monday through Sunday, calendar-aligned (not rolling 7-day windows)

Progress and Score both use Period boundaries to determine completeness.

**Framing timezone.** Each Habit has a `homeTz` captured from the owner's timezone at creation — sticky, does not auto-update when owner travels. The framing TZ determines period boundaries for the Habit:

- **solo** — logger's TZ (equivalent to owner's, since owner is sole logger).
- **cooperative-any** — owner's `homeTz`. Pool counts as a single shared scoreboard; participant entries converted to owner's frame at read.
- **cooperative-all** — each participant's own logger-TZ. Period is met only when every participant met their own week.

Owner may override `homeTz` via edit goal (versions the goal — past periods judged by their then-active TZ, future by new).

## Log Entry
A single record that a User performed the Habit. Authored by exactly one User (the logger); stored as TZ-aware ISO 8601 with the logger's offset. Capped per period — the cap shape depends on the Goal's cooperation mode:

- **solo** — cap is `targetCount` for the sole participant (the owner).
- **cooperative-any** — the cap is on the *shared* participant pool: combined Log Entries across all participants cannot exceed `targetCount` per period. One participant filling the cap leaves none for the others — the period is judged on the combined pool.
- **cooperative-all** — the cap is per participant at `targetCount` each. The pool can reach `targetCount × participantCount`.

## Progress
The number of Log Entries within the current period for a Habit. Compared against the Goal's target count to determine "complete/incomplete." Never exceeds the goal's effective cap.

In **cooperative-any**, Progress is the combined pool count across all participants. In **cooperative-all**, each participant has their own Progress; the Habit is complete only when every participant's Progress ≥ targetCount. In **solo**, Progress is the owner's count.

## Score
A cumulative gamification metric measuring how consistently a Habit meets its Goal. Computed on-the-fly from all completed periods since creation (or last reactivation). Period boundary (daily at midnight, weekly Monday, in the framing timezone per mode) triggers the update: +1 if Goal was met that period, -1 if not. Starts at 0. Can go negative. Ignores the current in-progress period. A period counts as final only when the latest framing TZ involved has rolled past its boundary (impl detail).

In **cooperative-any** and **cooperative-all**, Score is per-Habit and shared: all members see the same number. A period counts as met when the mode's completion rule is satisfied (shared pool reaches targetCount for any; every participant reaches targetCount for all). Score is not per-User when the Habit is cooperative.

---

# Domain Rules (resolved during design)

- **One Goal per Habit** — a Habit has exactly one active Goal at any time. Goals are versioned; score uses the goal active during each past period.
- **Calendar-aligned periods** — daily is a single calendar day, weekly is Mon-Sun.
- **Framing timezone is sticky** — Habit's `homeTz` is captured at creation from owner's timezone and does not auto-update on travel. Owner may override via edit goal (versions the goal — past periods judged by their then-active TZ, future by new). Period boundaries use the framing TZ per cooperation mode: solo/logger-TZ (owner's), cooperative-any/owner's `homeTz`, cooperative-all/each participant's logger-TZ.
- **Log entry cap per period** — capped by the Goal's target count per period; cap shape depends on cooperation mode (see Log Entry).
- **Score** — computed on-the-fly, not stored. Considers only completed past periods. Freezes on archive. Resets to 0 on reactivation (treated as fresh start). A period is final only after the latest TZ rolls past its boundary (impl detail, not a domain constraint).
- **Habit lifecycle** — can be created, edited (name + goal), archived (score frozen, hidden, no logging), or deleted (nukes all data).
- **Membership roles** — `owner | participant | observer`. Exactly one owner per Habit. Solo habits have only the owner. Cooperative habits have owner + ≥1 participant. Observers attach to any habit.
- **Observer visibility** — observers see goal, progress, and score. No granularity flags. Inviting an observer grants full read; motivation (support vs challenge) is a UI framing, not a role attribute.
- **Goal transformation creates a forming goal** — switching cooperation mode archives the current goal (which stays active and keeps scoring) and opens a new goal in `forming` status. The new goal becomes `active` only when every invited participant accepts. No scoring gap during the forming window.
- **Cooperation mode is versioned** — changing mode (solo → cooperative-any, cooperative-any → cooperative-all, etc.) archives the current goal and creates a new one. Past periods judged by their then-active mode; future by the new.
