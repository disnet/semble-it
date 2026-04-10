<script lang="ts">
	import type { CardType } from '$lib/types';

	type FilterValue = CardType | 'ALL' | 'UNCOLLECTED';
	type SortValue = 'newest' | 'oldest';

	let {
		filter = $bindable<FilterValue>('ALL'),
		sort = $bindable<SortValue>('newest')
	} = $props();

	let open = $state(false);

	const types: { label: string; value: FilterValue }[] = [
		{ label: 'All', value: 'ALL' },
		{ label: 'URL', value: 'URL' },
		{ label: 'Note', value: 'NOTE' },
		{ label: 'No collection', value: 'UNCOLLECTED' }
	];

	const sorts: { label: string; value: SortValue }[] = [
		{ label: 'Newest', value: 'newest' },
		{ label: 'Oldest', value: 'oldest' }
	];

	let hasActiveFilters = $derived(filter !== 'ALL' || sort !== 'newest');

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.filter-dropdown-wrapper')) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="filter-dropdown-wrapper">
	<button class="filter-toggle" class:active={hasActiveFilters} onclick={() => (open = !open)}>
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<line x1="2" y1="4" x2="14" y2="4" />
			<line x1="4" y1="8" x2="12" y2="8" />
			<line x1="6" y1="12" x2="10" y2="12" />
		</svg>
		Filters
	</button>

	{#if open}
		<div class="dropdown">
			<div class="dropdown-section">
				<span class="section-label">Sort</span>
				{#each sorts as s}
					<button
						class="dropdown-item"
						class:selected={sort === s.value}
						onclick={() => { sort = s.value; open = false; }}
					>
						{s.label}
						{#if sort === s.value}
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 8 7 12 13 4" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>

			<div class="dropdown-divider"></div>

			<div class="dropdown-section">
				<span class="section-label">Type</span>
				{#each types as t}
					<button
						class="dropdown-item"
						class:selected={filter === t.value}
						onclick={() => { filter = t.value; open = false; }}
					>
						{t.label}
						{#if filter === t.value}
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 8 7 12 13 4" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.filter-dropdown-wrapper {
		position: relative;
	}

	.filter-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: var(--radius-full);
		font-size: 0.8125rem;
		font-weight: 500;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.filter-toggle.active {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		min-width: 180px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 8px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		z-index: 100;
		padding: var(--space-xs) 0;
	}

	.dropdown-section {
		padding: 0 var(--space-xs);
	}

	.section-label {
		display: block;
		padding: 6px 10px 4px;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 8px 10px;
		border: none;
		border-radius: var(--radius-sm, 4px);
		background: none;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background 0.1s;
		text-align: left;
	}

	.dropdown-item:hover {
		background: var(--color-bg, #f5f5f5);
	}

	.dropdown-item.selected {
		font-weight: 600;
		color: var(--color-primary);
	}

	.dropdown-divider {
		height: 1px;
		background: var(--color-border);
		margin: var(--space-xs) 0;
	}
</style>
