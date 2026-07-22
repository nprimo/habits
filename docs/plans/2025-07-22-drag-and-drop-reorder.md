# Plan: Drag-and-Drop Habit Reorder

## Context

Habits are currently sorted by `created_at` ascending (oldest first). Users want to reorder habits to group them or prioritize certain ones higher. This requires a drag-and-drop feature in the "Today" view.

## Approach

### Library: `@horuse/svelte-dnd`
- Built for **Svelte 5** (runes, no legacy adapter)
- Pointer & touch support (works on mobile)
- Lightweight, TypeScript-first
- API: `DndProvider`, `DndDroppable`, `DndDraggable`, `DndController`, `sortable()`

### Schema Change: `sort_order` column

Add `sort_order INTEGER NOT NULL DEFAULT 0` to the `habits` table.

**Migration** (in `initDB`):
```sql
ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0
```

**Backfill existing rows**: Assign `sort_order` based on current `created_at` order (0, 1, 2, ...) so existing habits get a sensible initial order.

### Type Change

Add `sortOrder: number` to the `Habit` interface in `types.ts`.

### DB Function Changes

1. **`getActiveHabits()`** — Change `ORDER BY created_at` → `ORDER BY sort_order, created_at`
2. **`getArchivedHabits()`** — Keep `ORDER BY created_at` (archived habits aren't reorderable)
3. **New: `reorderHabits(orderedIds: string[])`** — Batch UPDATE `sort_order` for each habit by id
4. **`createHabit()`** — Set `sort_order` to max(sort_order) + 1 (appends to end)
5. **`unarchiveHabit()`** — Set `sort_order` to max(sort_order) + 1 (appends to end)

### UI Changes

#### `+page.svelte` (Today view)
- Wrap `{#each habits}` in `DndProvider` + `DndDroppable` with `strategy={sortable()}`
- Wrap each `HabitCard` in `DndDraggable`
- On drop: call `reorderHabits()` with new order, increment `refreshKey`

#### `HabitCard.svelte`
- Add a drag handle element (grip icon `⠿` or `⋮⋮`) on the left side of each card
- The handle is the drag target, not the whole card (so log/remove buttons still work easily)

### Files to Modify

| File | Change |
|---|---|
| `package.json` | Add `@horuse/svelte-dnd` dependency |
| `src/lib/types.ts` | Add `sortOrder` to `Habit` interface |
| `src/lib/db.ts` | Add migration, backfill, `reorderHabits()`, update `getActiveHabits()` sort, update `createHabit()`/`unarchiveHabit()` |
| `src/routes/+page.svelte` | Add DnD provider/droppable, handle drop event |
| `src/lib/components/HabitCard.svelte` | Add drag handle |
| `src/lib/db.test.ts` | Add tests for `reorderHabits()` and sort order |
| `src/lib/test-utils.ts` | Update `seedHabit()` to support `sort_order` |

### Testing

- **Unit tests** (`db.test.ts`):
  - `reorderHabits()` correctly updates sort_order values
  - `getActiveHabits()` returns habits in sort_order then created_at order
  - `createHabit()` appends to end (highest sort_order)
  - `unarchiveHabit()` appends to end
- **Manual test**: Drag habits in Today view, verify order persists after refresh

### Migration Safety

The `ALTER TABLE ... ADD COLUMN` is wrapped in try/catch (existing pattern). New column has `DEFAULT 0`, so existing rows get `sort_order = 0`. The backfill query runs after migration to assign proper sequential values.

## Verification

1. `pnpm test` — all existing + new tests pass
2. `pnpm check` — no type errors
3. Manual: create 3+ habits, drag to reorder, refresh page, verify order persists
4. Manual: archive then unarchive a habit, verify it appears at the end
