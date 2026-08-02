<script lang="ts">
	import HabitCard from '$lib/components/HabitCard.svelte';
	import HabitForm from '$lib/components/HabitForm.svelte';
	import {
		getHabitsWithProgress,
		getArchivedHabits,
		createHabit,
		updateHabit,
		archiveHabit,
		unarchiveHabit,
		deleteHabit,
		logEntry,
		reorderHabits,
		getPeriodBlocks
	} from '$lib/db';
	import type { Habit } from '$lib/types';

	let tab = $state<'today' | 'overview'>('today');

	let refreshKey = $state(0);
	function refresh() { refreshKey++; }

	let habits = $derived.by(() => { refreshKey; return getHabitsWithProgress(); });
	let incompleteHabits = $derived(habits.filter(h => !h.isComplete));
	let archived = $derived.by(() => { refreshKey; return getArchivedHabits(); });

	let showForm = $state(false);
	let editingHabit: Habit | undefined = $state(undefined);

	function openNew() {
		editingHabit = undefined;
		showForm = true;
	}
	function openEdit(h: Habit) {
		editingHabit = h;
		showForm = true;
	}

	function handleSave(name: string, goalCount: number, goalPeriod: 'daily' | 'weekly') {
		if (editingHabit) {
			updateHabit(editingHabit.id, name, goalCount, goalPeriod);
		} else {
			createHabit(name, goalCount, goalPeriod);
		}
		showForm = false;
		refresh();
	}

	function handleLog(habitId: string) {
		try {
			logEntry(habitId);
		} catch { /* cap reached — button already disabled */ }
		refresh();
	}

	function handleArchive(id: string) {
		archiveHabit(id);
		refresh();
	}

	function handleUnarchive(id: string) {
		unarchiveHabit(id);
		refresh();
	}

	function handleDelete(id: string) {
		if (confirm('Delete this habit and all its logs?')) {
			deleteHabit(id);
			refresh();
		}
	}

	function moveHabit(index: number, direction: -1 | 1) {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= habits.length) return;
		const updated = [...habits];
		[updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
		reorderHabits(updated.map(h => h.id));
		refresh();
	}
</script>

<div class="app">
	<header>
		<h1>Habits</h1>
		<nav>
			<button class="tab" class:active={tab === 'today'} onclick={() => tab = 'today'}>Today</button>
			<button class="tab" class:active={tab === 'overview'} onclick={() => tab = 'overview'}>Overview</button>
		</nav>
	</header>

	<main>
		{#if tab === 'today'}
			{#if habits.length === 0}
				<div class="empty">
					<p>No habits yet.</p>
					<button class="btn-primary" onclick={openNew}>Create your first habit</button>
				</div>
			{:else}
				{#if incompleteHabits.length === 0}
					<div class="empty">
						<p>All done for today!</p>
					</div>
				{:else}
					<div class="today-list">
						{#each incompleteHabits as h (h.id)}
							<HabitCard habit={h} onlog={() => handleLog(h.id)} />
						{/each}
					</div>
				{/if}
				<div class="fab">
					<button class="btn-fab" onclick={openNew} aria-label="Add habit">+</button>
				</div>
			{/if}
		{:else if tab === 'overview'}
			<div class="overview">
				{#if habits.length === 0 && archived.length === 0}
					<p class="muted">No habits yet.</p>
				{:else}
					{#each habits as h, index (h.id)}
								{@const blocks = getPeriodBlocks(h.id, 10)}
								<div class="overview-card" class:complete={h.isComplete}>
									<div class="overview-header">
										<div class="overview-info">
											<div class="reorder-actions" aria-label="Reorder habit">
												<button class="reorder-btn" disabled={index === 0} aria-label="Move up" onclick={() => moveHabit(index, -1)}>↑</button>
												<button class="reorder-btn" disabled={index === habits.length - 1} aria-label="Move down" onclick={() => moveHabit(index, 1)}>↓</button>
											</div>
											<span class="overview-name">{h.name}</span>
											<span class="overview-goal">{h.goalCount}/{h.goalPeriod === 'daily' ? 'day' : 'week'}</span>
										</div>
										<div class="overview-metrics">
											<span class="overview-progress" class:complete={h.isComplete}>{h.progress}/{h.goalCount}</span>
											<span class="overview-score">Score: {h.score}</span>
										</div>
									</div>
									<div class="overview-grid">
										{#each blocks as block (block.startDate)}
											<div
												class="block"
												class:complete={block.complete}
												class:current={block.isCurrent}
												title="{block.startDate}: {block.complete ? 'goal met' : 'goal not met'}"
											></div>
										{/each}
									</div>
									<div class="overview-actions">
										<button class="btn-sm" onclick={() => openEdit(h)}>Edit</button>
										<button class="btn-sm btn-archive" onclick={() => handleArchive(h.id)}>Archive</button>
										<button class="btn-sm btn-danger" onclick={() => handleDelete(h.id)}>Delete</button>
									</div>
								</div>
						{/each}

					{#if archived.length > 0}
						<h2 class="archived-h2">Archived</h2>
						{#each archived as h (h.id)}
							{@const blocks = getPeriodBlocks(h.id, 10)}
							<div class="overview-card archived">
								<div class="overview-header">
									<div class="overview-info">
										<span class="overview-name">{h.name}</span>
										<span class="overview-goal">{h.goalCount}/{h.goalPeriod === 'daily' ? 'day' : 'week'}</span>
									</div>
									<div class="overview-metrics">
										<span class="overview-progress">{h.progress}/{h.goalCount}</span>
										<span class="overview-score">Score: {h.score}</span>
									</div>
								</div>
								<div class="overview-grid">
									{#each blocks as block (block.startDate)}
										<div
											class="block"
											class:complete={block.complete}
											title="{block.startDate}: {block.complete ? 'goal met' : 'goal not met'}"
										></div>
									{/each}
								</div>
								<div class="overview-actions">
									<button class="btn-sm" onclick={() => handleUnarchive(h.id)}>Unarchive</button>
									<button class="btn-sm btn-danger" onclick={() => handleDelete(h.id)}>Delete</button>
								</div>
							</div>
						{/each}
					{/if}
				{/if}
				<div class="fab">
					<button class="btn-fab" onclick={openNew} aria-label="Add habit">+</button>
				</div>
			</div>
		{/if}
	</main>
</div>

{#if showForm}
	<HabitForm habit={editingHabit} onsave={handleSave} onclose={() => showForm = false} />
{/if}

<style>
	.app {
		max-width: 480px;
		margin: 0 auto;
		padding: 0 16px;
		padding-bottom: 80px;
	}
	header {
		padding: 16px 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 700;
	}
	nav {
		display: flex;
		gap: 4px;
		background: var(--color-gray-100);
		border-radius: var(--radius);
		padding: 3px;
	}
	.tab {
		flex: 1;
		padding: 8px;
		border-radius: 6px;
		background: transparent;
		color: var(--color-gray-500);
		font-weight: 500;
		transition: background 0.15s, color 0.15s;
	}
	.tab.active {
		background: white;
		color: var(--color-gray-800);
		box-shadow: 0 1px 2px rgba(0,0,0,0.08);
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px 0;
		color: var(--color-gray-400);
	}
	.btn-primary {
		padding: 10px 20px;
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius);
		font-weight: 500;
	}
	.btn-primary:hover {
		background: var(--color-primary-hover);
	}
	.fab {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
	}
	.btn-fab {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-size: 1.5rem;
		box-shadow: 0 4px 16px rgba(59,130,246,0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.15s, box-shadow 0.15s;
	}
	.btn-fab:hover {
		transform: scale(1.05);
		box-shadow: 0 6px 20px rgba(59,130,246,0.45);
	}

	/* Overview view */
	.today-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.overview {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.reorder-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.reorder-btn {
		width: 36px;
		height: 36px;
		padding: 0;
		border-radius: 8px;
		background: var(--color-gray-100);
		color: var(--color-gray-600);
		font-size: 1.25rem;
		line-height: 1;
	}
	.reorder-btn:disabled {
		color: var(--color-gray-300);
		cursor: default;
	}
	.reorder-btn:not(:disabled):hover {
		background: var(--color-gray-200);
	}
	.overview-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius);
	}
	.overview-card.complete {
		background: var(--color-green-bg);
		border-color: var(--color-green);
	}
	.overview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.overview-info {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.overview-name {
		font-weight: 600;
		font-size: 1rem;
	}
	.overview-goal {
		font-size: 0.75rem;
		color: var(--color-gray-400);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.overview-metrics {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.overview-progress {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-gray-500);
	}
	.overview-progress.complete {
		color: var(--color-green);
	}
	.overview-score {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-primary);
	}
	.overview-grid {
		display: flex;
		gap: 4px;
		justify-content: flex-end;
	}
	.block {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		background: var(--color-gray-200);
	}
	.block.complete {
		background: var(--color-green);
	}
	.block.current {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}
	.overview-actions {
		display: flex;
		gap: 4px;
		justify-content: flex-end;
		padding-top: 10px;
		border-top: 1px solid var(--color-gray-100);
	}
	.overview-card.archived {
		opacity: 0.6;
	}

	.btn-sm {
		padding: 6px 10px;
		border-radius: 6px;
		background: var(--color-gray-100);
		color: var(--color-gray-600);
		font-size: 0.75rem;
		font-weight: 500;
	}
	.btn-sm:hover {
		background: var(--color-gray-200);
	}
	.btn-archive {
		color: var(--color-gray-500);
	}
	.btn-danger {
		color: var(--color-red);
	}
	.muted {
		color: var(--color-gray-400);
		font-size: 0.875rem;
	}
	.archived-h2 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 12px;
	}
</style>
