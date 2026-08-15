# Domain Glossary

## Habit
A behavior the user wants to build (e.g., "drink enough water", "vacuum the house").

## Goal
A target frequency for a Habit over a period (e.g., "1/day", "2/week"). Composed of:

- **target count** — how many times (integer ≥ 1)
- **period** — the time window (`daily` or `weekly`)

Goals are **versioned**: changing a Habit's goal archives the old one (sets `to` timestamp) and creates a new current goal (`to` = null). Score recomputation uses the historical goal active during each past period — retroactive consistency.

## Period
The time window over which Progress is measured and compared to the Goal's target count. Two types:

- **daily** — a single calendar day (midnight to midnight local time)
- **weekly** — Monday through Sunday, calendar-aligned (not rolling 7-day windows)

Progress and Score both use Period boundaries to determine completeness.

## Log Entry
A single record that the user performed the Habit. Capped at the Goal's target count per period — you can't log more than the Goal requires.

## Progress
The number of Log Entries within the current period for a Habit. Compared against the Goal's target count to determine "complete/incomplete." Never exceeds the Goal's target count.

## Score
A cumulative gamification metric measuring how consistently a Habit meets its Goal. Computed on-the-fly from all completed periods since creation (or last reactivation). Period boundary (daily at midnight, weekly Monday) triggers the update: +1 if Goal was met that period, -1 if not. Starts at 0. Can go negative. Ignores the current in-progress period.

---

# Domain Rules (resolved during design)

- **One Goal per Habit** — a Habit has exactly one active Goal at any time. Goals are versioned; score uses the goal active during each past period.
- **Calendar-aligned periods** — daily is a single calendar day, weekly is Mon-Sun.
- **Log entry cap per period** — no more entries than the Goal's target count per period.
- **Score** — computed on-the-fly, not stored. Considers only completed past periods. Freezes on archive. Resets to 0 on reactivation (treated as fresh start).
- **Habit lifecycle** — can be created, edited (name + goal), archived (score frozen, hidden, no logging), or deleted (nukes all data).
