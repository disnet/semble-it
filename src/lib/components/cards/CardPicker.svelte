<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import type { Card } from '$lib/types';
	import CardTypeBadge from './CardTypeBadge.svelte';

	let {
		selected = $bindable<string | undefined>(undefined),
		excludeId = undefined as string | undefined,
		excludeIds = [] as string[],
		label = 'Select a card'
	} = $props();

	let search = $state('');
	let open = $state(false);
	let containerEl: HTMLDivElement | undefined = $state(undefined);

	const allCards = liveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());

	let filtered = $derived.by(() => {
		let cards = ($allCards ?? []).filter((c) => c.cardId !== excludeId && !excludeIds.includes(c.cardId));
		if (search.trim()) {
			const q = search.toLowerCase();
			cards = cards.filter((c) => {
				if (c.type === 'URL') return c.url.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q);
				if (c.type === 'NOTE') return c.text.toLowerCase().includes(q);
				return false;
			});
		}
		return cards;
	});

	let selectedCard = $derived(
		selected ? ($allCards ?? []).find((c) => c.cardId === selected) : undefined
	);

	function getCardLabel(card: Card): string {
		if (card.type === 'URL') return card.title || card.url;
		return card.text.slice(0, 80);
	}

	function handleSelect(cardId: string) {
		selected = cardId;
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
	<span class="picker-label">{label}</span>
	<div class="picker-input-wrap">
		{#if selectedCard && !open}
			<div class="picker-selected" onclick={() => { open = true; }} onkeydown={() => {}} role="button" tabindex="0">
				<CardTypeBadge type={selectedCard.type} />
				<span class="picker-selected-label">{getCardLabel(selectedCard)}</span>
				<button class="picker-clear" onclick={(e) => { e.stopPropagation(); selected = undefined; }}>✕</button>
			</div>
		{:else}
			<input
				type="search"
				placeholder="Search cards…"
				bind:value={search}
				onfocus={handleFocus}
				class="picker-search"
			/>
		{/if}
	</div>
	{#if open}
		<div class="picker-dropdown">
			{#each filtered as card (card.cardId)}
				<button
					class="picker-item"
					class:selected={selected === card.cardId}
					onclick={() => handleSelect(card.cardId)}
				>
					<CardTypeBadge type={card.type} />
					<span class="picker-item-label">{getCardLabel(card)}</span>
				</button>
			{/each}
			{#if filtered.length === 0}
				<p class="picker-empty">No cards found</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.picker {
		margin-bottom: var(--space-md);
		position: relative;
	}

	.picker-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-xs);
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

	.picker-selected {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.875rem;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.picker-selected:hover {
		border-color: var(--color-primary);
	}

	.picker-selected-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.picker-clear {
		flex-shrink: 0;
		padding: 0 var(--space-xs);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		cursor: pointer;
		line-height: 1;
	}

	.picker-clear:hover {
		color: var(--color-text);
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

	.picker-item.selected {
		background: var(--color-primary-light);
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
