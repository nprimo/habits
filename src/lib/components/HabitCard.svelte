<script lang="ts">
	import type { HabitWithProgress } from '$lib/types';

	let { habit, onlog }: { habit: HabitWithProgress; onlog: () => void } = $props();

	const pct = $derived(Math.min((habit.progress / habit.goalCount) * 100, 100));
	const barColor = $derived(habit.isComplete ? 'var(--color-green)' : 'var(--color-primary)');
</script>

<button class="card" class:complete={habit.isComplete} onclick={onlog}>
	<div class="info">
		<span class="name">{habit.name}</span>
		<span class="meta">{habit.goalCount}/{habit.goalPeriod === 'daily' ? 'day' : 'week'}</span>
	</div>
	<div class="progress-row">
		<div class="bar-track">
			<div class="bar-fill" style="width: {pct}%; background: {barColor}"></div>
		</div>
		<span class="count" class:done={habit.isComplete}>
			{habit.progress}/{habit.goalCount}
		</span>
	</div>
</button>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		padding: 16px;
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		text-align: left;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 2px 8px rgba(59,130,246,0.15);
	}
	.card.complete {
		background: var(--color-green-bg);
		border-color: var(--color-green);
	}
	.info {
		display: flex;
		justify-content: space-between;
		align-items: center;
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
	.progress-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.bar-track {
		flex: 1;
		height: 8px;
		background: var(--color-gray-100);
		border-radius: 4px;
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.2s;
	}
	.count {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-gray-500);
		min-width: 3em;
		text-align: right;
	}
	.count.done {
		color: var(--color-green);
	}
</style>
