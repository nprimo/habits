<script lang="ts">
	import type { HabitWithProgress, PeriodBlock } from '$lib/types';
	import { getPeriodBlocks } from '$lib/db';

	let { habit, onlog, onremove }: { habit: HabitWithProgress; onlog: () => void; onremove: () => void } = $props();

	let blocks = $derived(getPeriodBlocks(habit.id, 10));
</script>

<div class="card" class:complete={habit.isComplete}>
	<div class="header">
		<div class="info">
			<span class="name">{habit.name}</span>
			<span class="meta">{habit.goalCount}/{habit.goalPeriod === 'daily' ? 'day' : 'week'}</span>
		</div>
		<span class="score">Score: {habit.score}</span>
	</div>
	<div class="grid">
		{#each blocks as block (block.startDate)}
			<div
				class="block"
				class:complete={block.complete}
				class:current={block.isCurrent}
				title="{block.startDate}: {block.complete ? 'goal met' : 'goal not met'}"
			></div>
		{/each}
	</div>
	<div class="actions">
		<button class="btn-log" onclick={onlog} disabled={habit.isComplete} aria-label="Log entry">+</button>
		<button class="btn-undo" onclick={onremove} aria-label="Remove last entry">−</button>
	</div>
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		padding: 16px;
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}
	.card.complete {
		background: var(--color-green-bg);
		border-color: var(--color-green);
	}
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.info {
		display: flex;
		gap: 10px;
		align-items: baseline;
	}
	.name {
		font-weight: 600;
		font-size: 1rem;
	}
	.meta {
		font-size: 0.75rem;
		color: var(--color-gray-400);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.score {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-primary);
	}
	.grid {
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
	.actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}
	.btn-log {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: var(--color-primary);
		color: white;
		font-size: 1.25rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity 0.15s;
	}
	.btn-log:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.btn-log:not(:disabled):hover {
		opacity: 0.85;
	}
	.btn-undo {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: var(--color-gray-100);
		color: var(--color-gray-500);
		font-size: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.btn-undo:hover {
		background: var(--color-gray-200);
	}
</style>
