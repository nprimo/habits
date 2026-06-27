# Domain Glossary

## Habit
A behavior the user wants to build (e.g., "drink enough water", "vacuum the house").

## Goal
A target frequency for a Habit over a period (e.g., "1/day", "2/week"). Composed of a **target count** and a **period**.

## Log Entry
A single record that the user performed the Habit.

## Progress
The number of Log Entries within the current period for a Habit. Compared against the Goal's target count to determine "complete/incomplete."

---

# Domain Rules (resolved during design)

- **One Goal per Habit** — a Habit has exactly one Goal.
- **Calendar-aligned periods** — daily resets at midnight, weekly resets Monday.
- **Logging** — any number of entries per period, any past date accepted, no upper cap.
- **No streaks** — computed on-the-fly if needed; not part of domain model.
- **Habit lifecycle** — can be created, edited (name + goal), archived (hidden, no logging), or deleted (nukes all data).
