<script lang="ts">
	import type { Habit } from '$lib/types';
	import { getLogCountsByDate, logEntry, removeLogEntriesForDate } from '$lib/db';

	let { habit }: { habit: Habit } = $props();

	const today = new Date();
	const todayStr = formatDate(today);
	// svelte-ignore state_referenced_locally
	const createdStr = habit.createdAt.slice(0, 10);
	const [cy, cm, cd] = createdStr.split('-').map(Number);
	const createdDate = new Date(cy, cm - 1, cd);

	function cutoff(): Date {
		return habit.archivedAt ? new Date(habit.archivedAt) : today;
	}

	function key(y: number, m: number): number {
		return y * 12 + m;
	}

	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());

	let canPrev = $derived(key(viewYear, viewMonth) > key(createdDate.getFullYear(), createdDate.getMonth()));
	let canNext = $derived(key(viewYear, viewMonth) < key(cutoff().getFullYear(), cutoff().getMonth()));

	const monthLabel = $derived(
		new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
	);

	function prevMonth() {
		if (!canPrev) return;
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear--;
		} else {
			viewMonth--;
		}
	}
	function nextMonth() {
		if (!canNext) return;
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear++;
		} else {
			viewMonth++;
		}
	}

	let logCounts = $state<Record<string, number>>({});

	function loadCounts() {
		logCounts = getLogCountsByDate(habit.id);
	}

	loadCounts();

	const calendarDays = $derived.by(() => {
		const firstOfMonth = new Date(viewYear, viewMonth, 1);
		const startDow = firstOfMonth.getDay();
		const offset = startDow === 0 ? 6 : startDow - 1;
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const c = cutoff();

		type Cell = {
			day: number;
			dateStr: string;
			disabled: boolean;
		} | null;

		const cells: Cell[] = [];
		for (let i = 0; i < offset; i++) cells.push(null);
		for (let day = 1; day <= daysInMonth; day++) {
			const dt = new Date(viewYear, viewMonth, day);
			const dateStr = formatDate(dt);
			const disabled = dt < createdDate || dt > c;
			cells.push({ day, dateStr, disabled });
		}
		return cells;
	});

	const weeks = $derived.by(() => {
		const result: { monday: string; sunday: string; count: number }[] = [];
		const c = cutoff();

		const [ty, tm] = [viewYear, viewMonth];
		const firstOfMonth = new Date(ty, tm, 1);
		const dom = firstOfMonth.getDay();
		const diffToMonday = dom === 0 ? -6 : 1 - dom;
		const cursor = new Date(firstOfMonth);
		cursor.setDate(cursor.getDate() + diffToMonday);

		while (cursor.getMonth() === tm && cursor.getFullYear() === ty && cursor <= c) {
			const m = new Date(cursor);
			if (m < createdDate) {
				cursor.setDate(cursor.getDate() + 7);
				continue;
			}
			const s = new Date(m);
			s.setDate(m.getDate() + 6);
			const ms = formatDate(m);
			const ss = formatDate(s);

			let count = 0;
			const dayCursor = new Date(m);
			while (dayCursor <= s) {
				const ds = formatDate(dayCursor);
				count += logCounts[ds] || 0;
				dayCursor.setDate(dayCursor.getDate() + 1);
			}

			result.push({ monday: ms, sunday: ss, count });
			cursor.setDate(cursor.getDate() + 7);
		}
		return result;
	});

	function cycleDay(dateStr: string) {
		const current = logCounts[dateStr] || 0;
		if (current < habit.goalCount) {
			logEntry(habit.id, dateStr);
		} else {
			removeLogEntriesForDate(habit.id, dateStr);
		}
		loadCounts();
	}

	function weekMidweek(mondayStr: string): string {
		const [y, m, d] = mondayStr.split('-').map(Number);
		const dt = new Date(y, m - 1, d + 2);
			return formatDate(dt);
	}

	function cycleWeek(mondayStr: string) {
		const current = weeks.find(w => w.monday === mondayStr)?.count || 0;
		if (current < habit.goalCount) {
			logEntry(habit.id, weekMidweek(mondayStr));
		} else {
			const [y, m, d] = mondayStr.split('-').map(Number);
			const cursor = new Date(y, m - 1, d);
			for (let i = 0; i < 7; i++) {
				const ds = formatDate(cursor);
				removeLogEntriesForDate(habit.id, ds);
				cursor.setDate(cursor.getDate() + 1);
			}
		}
		loadCounts();
	}

	function formatDate(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function formatRange(mondayStr: string, sundayStr: string): string {
		const [ym, mm, dm] = mondayStr.split('-').map(Number);
		const [ys, ms, ds] = sundayStr.split('-').map(Number);
		const m1 = new Date(ym, mm - 1, dm).toLocaleString('default', { month: 'short' });
		const m2 = new Date(ys, ms - 1, ds).toLocaleString('default', { month: 'short' });
		return `${m1} ${dm} – ${m2} ${ds}`;
	}
</script>

{#if habit.goalPeriod === 'daily'}
	<div class="log-calendar">
		<div class="month-nav">
			<button class="nav-btn" onclick={prevMonth} disabled={!canPrev} aria-label="Previous month">‹</button>
			<span class="month-label">{monthLabel}</span>
			<button class="nav-btn" onclick={nextMonth} disabled={!canNext} aria-label="Next month">›</button>
		</div>
		<div class="cal-grid">
			<span class="dow">Mo</span>
			<span class="dow">Tu</span>
			<span class="dow">We</span>
			<span class="dow">Th</span>
			<span class="dow">Fr</span>
			<span class="dow">Sa</span>
			<span class="dow">Su</span>
			{#each calendarDays as cell, i (i)}
				{#if cell === null}
					<span></span>
				{:else if cell.disabled}
					<span class="day-btn day-disabled" aria-disabled="true">{cell.day}</span>
				{:else}
					{@const count = logCounts[cell.dateStr] || 0}
					<button
						class="day-btn"
						class:empty={count === 0}
						class:has-logs={count > 0}
						class:full={count >= habit.goalCount}
						class:today={cell.dateStr === todayStr}
						onclick={() => cycleDay(cell.dateStr)}
					>
						{cell.day}
						{#if count > 0}
							<span class="count">{count}</span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>
	</div>
{:else}
	<div class="log-calendar weekly">
		<div class="month-nav">
			<button class="nav-btn" onclick={prevMonth} disabled={!canPrev} aria-label="Previous month">‹</button>
			<span class="month-label">{monthLabel}</span>
			<button class="nav-btn" onclick={nextMonth} disabled={!canNext} aria-label="Next month">›</button>
		</div>
		<h3 class="weekly-title">Log History</h3>
		<div class="week-list">
			{#if weeks.length === 0}
				<p class="muted">No weeks in this month.</p>
			{:else}
				{#each weeks as week (week.monday)}
					<button
						class="week-btn"
						class:empty={week.count === 0}
						class:has-logs={week.count > 0}
						class:full={week.count >= habit.goalCount}
						onclick={() => cycleWeek(week.monday)}
					>
						<span class="week-range">{formatRange(week.monday, week.sunday)}</span>
						<span class="week-count">{week.count}/{habit.goalCount}</span>
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}

<style>
	.log-calendar {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--color-gray-200);
	}

	.month-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.nav-btn {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-gray-600);
		background: var(--color-gray-100);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.12s;
	}
	.nav-btn:hover:not(:disabled) {
		background: var(--color-gray-200);
	}
	.nav-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.month-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-gray-700);
	}

	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
	}
	.dow {
		text-align: center;
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--color-gray-400);
		padding: 2px 0 4px;
		text-transform: uppercase;
	}

	.day-btn {
		aspect-ratio: 1;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		font-size: 0.75rem;
		font-weight: 500;
		transition: background 0.12s;
		position: relative;
	}
	.day-btn.empty {
		background: var(--color-gray-100);
		color: var(--color-gray-500);
	}
	.day-btn.empty:hover {
		background: var(--color-gray-200);
	}
	.day-btn.has-logs {
		background: var(--color-green);
		color: white;
	}
	.day-btn.has-logs:hover {
		background: #16a34a;
	}
	.day-btn.full {
		background: #15803d;
		color: white;
	}
	.day-btn.full:hover {
		background: #166534;
	}
	.day-btn.today {
		box-shadow: inset 0 0 0 2px var(--color-primary);
	}
	.day-disabled {
		display: flex;
		aspect-ratio: 1;
		border-radius: 6px;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-gray-300);
	}
	.count {
		font-size: 0.55rem;
		font-weight: 700;
		line-height: 1;
	}

	.weekly-title {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-gray-500);
		margin-bottom: 8px;
	}
	.week-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.week-btn {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 0.8rem;
		transition: background 0.12s;
	}
	.week-btn.empty {
		background: var(--color-gray-100);
		color: var(--color-gray-500);
	}
	.week-btn.empty:hover {
		background: var(--color-gray-200);
	}
	.week-btn.has-logs {
		background: var(--color-green);
		color: white;
	}
	.week-btn.has-logs:hover {
		background: #16a34a;
	}
	.week-btn.full {
		background: #15803d;
		color: white;
	}
	.week-btn.full:hover {
		background: #166534;
	}
	.week-range {
		font-weight: 500;
	}
	.week-count {
		font-weight: 700;
		font-size: 0.75rem;
	}
	.muted {
		color: var(--color-gray-400);
		font-size: 0.8rem;
		text-align: center;
		padding: 8px 0;
	}
</style>