<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';

	let {
		selected = $bindable<string | undefined>(undefined),
		excludeIds = [] as string[]
	} = $props();

	let search = $state('');
	let open = $state(false);
	let containerEl: HTMLDivElement | undefined = $state(undefined);

	const allCollections = liveQuery(() => db.collections.orderBy('createdAt').reverse().toArray());

	let filtered = $derived.by(() => {
		let cols = ($allCollections ?? []).filter((c) => !excludeIds.includes(c.collectionId));
		if (search.trim()) {
			const q = search.toLowerCase();
			cols = cols.filter((c) => c.name.toLowerCase().includes(q));
		}
		return cols;
	});

	function handleSelect(collectionId: string) {
		selected = collectionId;
		open = false;
		search = '';
	}

	function handleFocus() {
		open = true;
	}

	function handleClickOutside(e: MouseEvent) {
		if (containerEl && !containerEl.contains(e.target as Node)) {
			open = false;
		}
	}

	$effect(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	});
</script>

<div class="picker" bind:this={containerEl}>
	<div class="picker-input-wrap">
		<input
			type="search"
			placeholder="Add to collection..."
			bind:value={search}
			onfocus={handleFocus}
			class="picker-search"
		/>
	</div>
	{#if open}
		<div class="picker-dropdown">
			{#each filtered as col (col.collectionId)}
				<button
					class="picker-item"
					onclick={() => handleSelect(col.collectionId)}
				>
					<span class="picker-item-label">{col.name}</span>
				</button>
			{/each}
			{#if filtered.length === 0}
				<p class="picker-empty">No collections found</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.picker {
		position: relative;
	}

	.picker-input-wrap {
		position: relative;
	}

	.picker-search {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.875rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.picker-search:focus {
		border-color: var(--color-primary);
	}

	.picker-dropdown {
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		margin-top: 2px;
		max-height: 240px;
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 10;
	}

	.picker-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		font-size: 0.8125rem;
		border-bottom: 1px solid var(--color-border);
		transition: background 0.15s;
	}

	.picker-item:last-child {
		border-bottom: none;
	}

	.picker-item:hover {
		background: var(--color-bg);
	}

	.picker-item-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.picker-empty {
		padding: var(--space-md);
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}
</style>
