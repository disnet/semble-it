<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import type { CardType } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardFilterBar from '$lib/components/cards/CardFilterBar.svelte';
	import CardListItem from '$lib/components/cards/CardListItem.svelte';
	import ScrollSentinel from '$lib/components/shared/ScrollSentinel.svelte';

	const PAGE_SIZE = 20;
	type FilterValue = CardType | 'ALL';
	let filter: FilterValue = $state('ALL');
	let search = $state('');
	let visibleCount = $state(PAGE_SIZE);

	const allCards = liveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());

	let filteredCards = $derived.by(() => {
		let cards = $allCards ?? [];
		if (filter !== 'ALL') {
			cards = cards.filter((c) => c.type === filter);
		}
		if (search.trim()) {
			const q = search.toLowerCase();
			cards = cards.filter((c) => {
				if (c.type === 'URL') {
					return (
						c.url.toLowerCase().includes(q) ||
						c.title?.toLowerCase().includes(q) ||
						c.description?.toLowerCase().includes(q)
					);
				}
				if (c.type === 'NOTE') {
					return c.text.toLowerCase().includes(q);
				}
				return false;
			});
		}
		return cards;
	});

	// Reset visible count when filters change
	$effect(() => {
		filter;
		search;
		visibleCount = PAGE_SIZE;
	});

	let visibleCards = $derived(filteredCards.slice(0, visibleCount));
	let hasMore = $derived(visibleCount < filteredCards.length);
</script>

<PageHeader title="Cards" />

<CardFilterBar bind:value={filter} />

<div class="search-bar">
	<input type="search" placeholder="Search cards…" bind:value={search} class="search-input" />
</div>

<div class="card-list">
	{#if filteredCards.length === 0}
		<div class="empty-state">
			<p class="empty-title">No cards yet</p>
			<p class="empty-text">Tap the + button to add your first card</p>
		</div>
	{:else}
		{#each visibleCards as card (card.cardId)}
			<CardListItem {card} />
		{/each}
		{#if hasMore}
			<ScrollSentinel onVisible={() => (visibleCount += PAGE_SIZE)} />
		{/if}
	{/if}
</div>

<style>
	.search-bar {
		padding: 0 var(--space-md) var(--space-sm);
	}

	.search-input {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		background: var(--color-surface);
		font-size: 0.875rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.search-input:focus {
		border-color: var(--color-primary);
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: 0 var(--space-md) var(--space-md);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-xl) var(--space-md);
	}

	.empty-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: var(--space-xs);
	}

	.empty-text {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
</style>
