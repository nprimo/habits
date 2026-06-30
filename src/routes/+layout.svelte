<script lang="ts">
	import '../app.css';
	import { initDB } from '$lib/db';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	$effect(() => {
		let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
		if (!link) {
			link = document.createElement('link');
			link.rel = 'icon';
			document.head.appendChild(link);
		}
		link.href = favicon;
	});

	let ready = $state(false);
	let error = $state('');

	onMount(async () => {
		try {
			await initDB();
			ready = true;
		} catch (e) {
			error = (e as Error).message;
		}
	});
</script>

{#if error}
	<div class="error">
		<p>Failed to initialize: {error}</p>
	</div>
{:else if !ready}
	<div class="loading">
		<p>Loading...</p>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.loading, .error {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		color: var(--color-gray-500);
	}
	.error { color: var(--color-red); }
</style>
