# Habit Tracker — PRD

## Problem Statement

The user needs a way to build and maintain habits by tracking behaviors, setting frequency goals, and monitoring consistency over time. Existing solutions are either too complex or lack the domain-specific mechanics (period-based goals, score streaks, log caps) that make habit tracking effective.

## Solution

A single-page PWA habit tracker where users create habits with configurable Goals (daily/weekly, target count), log entries against those Goals, and see their progress and cumulative Score. Habits can be managed (edited, archived, deleted) and reordered to reflect priority.

## User Stories

1. As a user, I want to create a habit with a name and Goal (target count + period), so that I can start tracking a behavior
2. As a user, I want to log that I performed a habit, so that I have a record of my behavior
3. As a user, I want to see my current Progress ("X/Y") for the active period, so that I know how close I am to my Goal
4. As a user, I want the system to prevent me from logging more entries than the Goal allows per period, so that I can't over-count
5. As a user, I want to edit past logs for a given habit, so that I can correct mistakes or backfill entries
6. As a user, I want to see a Score that rewards consistency (+1 met, -1 missed) across completed periods, so that I'm motivated to maintain streaks
7. As a user, I want to see a visual grid of my last 10 periods, so that I can spot patterns in my performance
8. As a user, I want to edit a habit's name and Goal, so that I can adjust my targets as my needs change
9. As a user, I want to archive a habit to hide it while preserving my history, so that I can pause tracking without losing data
10. As a user, I want to delete a habit and all its associated data, so that I can permanently remove a behavior I no longer track
11. As a user, I want to reorder my habits via drag and drop, so that I can prioritize what matters most

## Implementation Decisions

- **Tech stack**: SvelteKit 2 + Svelte 5 (runes), TypeScript, sql.js (SQLite WASM) persisted to IndexedDB, deployed as static SPA on Cloudflare Workers
- **Domain model**: One Goal per Habit, calendar-aligned periods (daily resets at midnight, weekly resets Monday), log entry cap enforced per period
- **Score**: Computed on-the-fly, not stored. Considers only completed past periods. Freezes on archive. Resets to 0 on reactivation.
- **Period blocks**: GitHub-style grid of last 10 periods, green (met) / gray (missed), current period highlighted
- **Data layer**: Single `db.ts` module owns all CRUD, scoring, progress, and period block logic
- **UI**: Single page with "Today" (log view) and "Manage" (edit/archive/delete) tabs, FAB for new habits

## Testing Decisions

- **What makes a good test**: External behavior only — inputs produce correct outputs, no implementation detail assertions
- **Modules to test**: `db.ts` (CRUD, scoring, progress, period blocks, reorder), `HabitCard.svelte` (progress display, log/undo), `HabitForm.svelte` (validation, goal config)
- **Prior art**: Existing `db.test.ts` (integration with fake-indexeddb) and `score.test.ts` (unit with fake timers) establish patterns. Use `test-utils.ts` for DB setup/teardown.

## Out of Scope

- Offline support / full PWA offline caching
- Single-habit detail page (`/habit/:id`)
- Color-coded health indicators per habit
- Notes or descriptions on habits
- Habit limits (max N per user)
- Past-date logging UI (backend logic exists, no UI yet)

## Further Notes

- User story #5 (edit past logs) has backend support via `logEntry(id, date)` but no UI — this is a candidate for next iteration
- Domain rules are documented in `CONTEXT.md` and should be the source of truth for glossary and constraints
