<script lang="ts">
	import type { Habit } from '$lib/types';
	import LogCalendar from './LogCalendar.svelte';

	let {
		habit,
		onsave,
		onclose
	}: {
		habit?: Habit;
		onsave: (name: string, goalCount: number, goalPeriod: 'daily' | 'weekly') => void;
		onclose: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let name = $state(habit?.name ?? '');
	// svelte-ignore state_referenced_locally
	let goalCount = $state(habit?.goalCount ?? 1);
	// svelte-ignore state_referenced_locally
	let goalPeriod = $state<'daily' | 'weekly'>(habit?.goalPeriod ?? 'daily');

	function submit(e: Event) {
		e.preventDefault();
		if (!name.trim()) return;
		blurActiveElement();
		onsave(name.trim(), goalCount, goalPeriod);
	}

	function blurActiveElement() {
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	function close() {
		blurActiveElement();
		onclose();
	}

	function keydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={keydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="presentation">
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
		<h2>{habit ? 'Edit Habit' : 'New Habit'}</h2>
		<form onsubmit={submit}>
			<label>
				<span>Name</span>
				<input type="text" bind:value={name} placeholder="e.g. Drink water" />
			</label>
			<label>
				<span>Goal</span>
				<div class="goal-row">
					<input type="number" bind:value={goalCount} min="1" max="99" />
					<select bind:value={goalPeriod}>
						<option value="daily">per day</option>
						<option value="weekly">per week</option>
					</select>
				</div>
			</label>
			<div class="actions">
					<button type="button" class="btn-cancel" onclick={close}>Cancel</button>
				<button type="submit" class="btn-save" disabled={!name.trim()}>
					{habit ? 'Save' : 'Create'}
				</button>
			</div>
		</form>
		{#if habit}
			<LogCalendar {habit} />
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 16px;
	}
	.modal {
		background: white;
		border-radius: 12px;
		padding: 24px;
		width: 100%;
		max-width: 360px;
		box-shadow: 0 8px 32px rgba(0,0,0,0.15);
	}
	h2 {
		font-size: 1.125rem;
		margin-bottom: 16px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-gray-600);
	}
	input[type="text"], input[type="number"], select {
		font-size: 16px;
		padding: 8px 10px;
		border: 1px solid var(--color-gray-300);
		border-radius: var(--radius);
		outline: none;
		transition: border-color 0.15s;
	}
	input[type="text"]:focus, input[type="number"]:focus, select:focus {
		border-color: var(--color-primary);
	}
	input[type="number"] {
		width: 64px;
	}
	.goal-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	select {
		flex: 1;
	}
	.actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 4px;
	}
	.btn-cancel, .btn-save {
		padding: 8px 16px;
		border-radius: var(--radius);
		font-weight: 500;
	}
	.btn-cancel {
		background: var(--color-gray-100);
		color: var(--color-gray-600);
	}
	.btn-cancel:hover {
		background: var(--color-gray-200);
	}
	.btn-save {
		background: var(--color-primary);
		color: white;
	}
	.btn-save:hover {
		background: var(--color-primary-hover);
	}
	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
