<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import type { Card } from '$lib/types';
	import CardTypeBadge from './CardTypeBadge.svelte';

	let {
		selected = $bindable<string | undefined>(undefined),
		excludeId = undefined as string | undefined,
		label = 'Select a card'
	} = $props();

	let search = $state('');

	const allCards = liveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());

	let filtered = $derived.by(() => {
		let cards = ($allCards ?? []).filter((c) => c.cardId !== excludeId);
		if (search.trim()) {
			const q = search.toLowerCase();
			cards = cards.filter((c) => {
				if (c.type === 'URL') return c.url.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q);
				if (c.type === 'NOTE') return c.text.toLowerCase().includes(q);
				if (c.type === 'HIGHLIGHT') return c.text.toLowerCase().includes(q) || c.sourceTitle?.toLowerCase().includes(q);
				return false;
			});
		}
		return cards;
	});

	function getCardLabel(card: Card): string {
		if (card.type === 'URL') return card.title || card.url;
		return card.text.slice(0, 80);
	}
</script>

<div class="picker">
	<span class="picker-label">{label}</span>
	<input type="search" placeholder="Search cards…" bind:value={search} class="picker-search" />
	<div class="picker-list">
		{#each filtered as card (card.cardId)}
			<button
				class="picker-item"
				class:selected={selected === card.cardId}
				onclick={() => (selected = card.cardId)}
			>
				<CardTypeBadge type={card.type} />
				<span class="picker-item-label">{getCardLabel(card)}</span>
			</button>
		{/each}
		{#if filtered.length === 0}
			<p class="picker-empty">No cards found</p>
		{/if}
	</div>
</div>

<style>
	.picker {
		margin-bottom: var(--space-md);
	}

	.picker-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-xs);
	}

	.picker-search {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.875rem;
		outline: none;
		margin-bottom: var(--space-sm);
		transition: border-color 0.15s;
	}

	.picker-search:focus {
		border-color: var(--color-primary);
	}

	.picker-list {
		max-height: 200px;
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
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
