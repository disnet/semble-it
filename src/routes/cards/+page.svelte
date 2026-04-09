<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { syncFromPDS, resolveFollowMetadata } from '$lib/pds';
	import type { CardType } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import RefreshBar from '$lib/components/shared/RefreshBar.svelte';
	import CardFilterBar from '$lib/components/cards/CardFilterBar.svelte';
	import CardListItem from '$lib/components/cards/CardListItem.svelte';
	import ScrollSentinel from '$lib/components/shared/ScrollSentinel.svelte';

	const PAGE_SIZE = 20;
	type FilterValue = CardType | 'ALL';
	type SortValue = 'newest' | 'oldest';
	let filter: FilterValue = $state('ALL');
	let sort: SortValue = $state('newest');
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
		if (sort === 'oldest') {
			cards = [...cards].reverse();
		}
		return cards;
	});

	// Reset visible count when filters change
	$effect(() => {
		filter;
		sort;
		search;
		visibleCount = PAGE_SIZE;
	});

	let visibleCards = $derived(filteredCards.slice(0, visibleCount));
	let hasMore = $derived(visibleCount < filteredCards.length);

	async function handleRefresh() {
		if (!auth.session) return;
		await syncFromPDS(auth.session);
		resolveFollowMetadata(auth.session).catch(console.error);
	}
</script>

<PageHeader title="Cards" />
<RefreshBar cacheKey="pds-sync" onrefresh={handleRefresh} />

<div class="toolbar">
	<CardFilterBar bind:filter bind:sort />
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
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
	}

	.search-input {
		flex: 1;
		min-width: 0;
		padding: 6px var(--space-md);
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
