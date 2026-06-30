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
		removeLogEntry,
		getLogEntries
	} from '$lib/db';
	import type { Habit } from '$lib/types';

	let tab = $state<'today' | 'manage'>('today');

	let refreshKey = $state(0);
	function refresh() { refreshKey++; }

	let habits = $derived.by(() => { refreshKey; return getHabitsWithProgress(); });
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

	function handleRemoveLastLog(habitId: string) {
		const entries = getLogEntries(habitId);
		if (entries.length > 0) {
			removeLogEntry(entries[0].id);
			refresh();
		}
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
</script>

<div class="app">
	<header>
		<h1>Habits</h1>
		<nav>
			<button class="tab" class:active={tab === 'today'} onclick={() => tab = 'today'}>Today</button>
			<button class="tab" class:active={tab === 'manage'} onclick={() => tab = 'manage'}>Manage</button>
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
				<div class="habit-list">
					{#each habits as h (h.id)}
						<HabitCard habit={h} onlog={() => handleLog(h.id)} onremove={() => handleRemoveLastLog(h.id)} />
					{/each}
				</div>
				<div class="fab">
					<button class="btn-fab" onclick={openNew} aria-label="Add habit">+</button>
				</div>
			{/if}
		{:else}
			<div class="manage">
				<div class="manage-header">
					<h2>Active</h2>
					<button class="btn-primary" onclick={openNew}>+ New</button>
				</div>
				{#if habits.length === 0}
					<p class="muted">No active habits.</p>
				{:else}
					<div class="manage-list">
						{#each habits as h (h.id)}
							<div class="manage-item">
								<div class="item-info">
									<strong>{h.name}</strong>
									<span class="item-meta">{h.goalCount}/{h.goalPeriod}</span>
								</div>
								<div class="item-actions">
									<button class="btn-sm" onclick={() => openEdit(h)}>Edit</button>
									<button class="btn-sm btn-archive" onclick={() => handleArchive(h.id)}>Archive</button>
									<button class="btn-sm btn-danger" onclick={() => handleDelete(h.id)}>Delete</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if archived.length > 0}
					<h2 class="archived-h2">Archived</h2>
					<div class="manage-list">
						{#each archived as h (h.id)}
							<div class="manage-item archived">
								<div class="item-info">
									<strong>{h.name}</strong>
									<span class="item-meta">{h.goalCount}/{h.goalPeriod}</span>
								</div>
								<div class="item-actions">
									<button class="btn-sm" onclick={() => handleUnarchive(h.id)}>Unarchive</button>
									<button class="btn-sm btn-danger" onclick={() => handleDelete(h.id)}>Delete</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
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
	.habit-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
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

	/* Manage view */
	.manage-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}
	.manage-header h2 {
		font-size: 1rem;
		font-weight: 600;
	}
	.manage-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 20px;
	}
	.manage-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px;
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius);
	}
	.manage-item.archived {
		opacity: 0.6;
	}
	.item-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.item-meta {
		font-size: 0.75rem;
		color: var(--color-gray-400);
	}
	.item-actions {
		display: flex;
		gap: 4px;
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
