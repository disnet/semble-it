<script lang="ts">
	import type { CardType } from '$lib/types';

	type FilterValue = CardType | 'ALL';

	let { value = $bindable<FilterValue>('ALL') } = $props();

	const filters: { label: string; value: FilterValue }[] = [
		{ label: 'All', value: 'ALL' },
		{ label: 'URL', value: 'URL' },
		{ label: 'Note', value: 'NOTE' }
	];
</script>

<div class="filter-bar">
	{#each filters as filter}
		<button
			class="filter-pill"
			class:active={value === filter.value}
			onclick={() => (value = filter.value)}
		>
			{filter.label}
		</button>
	{/each}
</div>

<style>
	.filter-bar {
		display: flex;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.filter-pill {
		padding: 6px 14px;
		border-radius: var(--radius-full);
		font-size: 0.8125rem;
		font-weight: 500;
		white-space: nowrap;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}

	.filter-pill.active {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}
</style>
