# Domain Glossary

## Habit
A behavior the user wants to build (e.g., "drink enough water", "vacuum the house").

## Goal
A target frequency for a Habit over a period (e.g., "1/day", "2/week"). Composed of a **target count** and a **period**.

## Log Entry
A single record that the user performed the Habit. Capped at the Goal's target count per period — you can't log more than the Goal requires.

## Progress
The number of Log Entries within the current period for a Habit. Compared against the Goal's target count to determine "complete/incomplete." Never exceeds the Goal's target count.

## Score
A cumulative gamification metric measuring how consistently a Habit meets its Goal. Computed on-the-fly from all completed periods since creation (or last reactivation). Period boundary (daily at midnight, weekly Monday) triggers the update: +1 if Goal was met that period, -1 if not. Starts at 0. Can go negative. Ignores the current in-progress period.

---

# Domain Rules (resolved during design)

- **One Goal per Habit** — a Habit has exactly one Goal.
- **Calendar-aligned periods** — daily resets at midnight, weekly resets Monday.
- **Log entry cap per period** — no more entries than the Goal's target count per period.
- **Score** — computed on-the-fly, not stored. Considers only completed past periods. Freezes on archive. Resets to 0 on reactivation (treated as fresh start).
- **Habit lifecycle** — can be created, edited (name + goal), archived (score frozen, hidden, no logging), or deleted (nukes all data).
