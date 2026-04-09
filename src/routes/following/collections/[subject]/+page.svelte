<script lang="ts">
	import { page } from '$app/stores';
	import { fetchRemoteCollectionCached, fetchRemoteCollectionFresh } from '$lib/pds';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import RefreshBar from '$lib/components/shared/RefreshBar.svelte';
	import RemoteCardItem from '$lib/components/cards/RemoteCardItem.svelte';
	import ScrollSentinel from '$lib/components/shared/ScrollSentinel.svelte';

	const subject = $derived(decodeURIComponent($page.params.subject!));

	const PAGE_SIZE = 20;
	let visibleCount = $state(PAGE_SIZE);

	let collectionName = $state('Collection');
	let collectionDesc = $state<string | undefined>(undefined);
	let cards = $state<Array<Record<string, unknown>>>([]);
	let loading = $state(true);

	$effect(() => {
		const currentSubject = subject;
		loading = true;
		visibleCount = PAGE_SIZE;
		collectionName = 'Collection';
		collectionDesc = undefined;
		cards = [];

		(async () => {
			// Try cache first
			const cached = await fetchRemoteCollectionCached(currentSubject);
			if (cached) {
				collectionName = cached.collectionName;
				collectionDesc = cached.collectionDesc;
				cards = cached.cards;
				loading = false;
				return;
			}
			// No cache — fetch fresh
			const fresh = await fetchRemoteCollectionFresh(currentSubject);
			collectionName = fresh.collectionName;
			collectionDesc = fresh.collectionDesc;
			cards = fresh.cards;
			loading = false;
		})();
	});

	async function handleRefresh() {
		const fresh = await fetchRemoteCollectionFresh(subject);
		collectionName = fresh.collectionName;
		collectionDesc = fresh.collectionDesc;
		cards = fresh.cards;
	}
</script>

<PageHeader title={collectionName} />
<RefreshBar cacheKey={`remote-collection:${subject}`} onrefresh={handleRefresh} />

<div class="detail-container">
	{#if loading}
		<p class="loading-text">Loading...</p>
	{:else}
		{#if collectionDesc}
			<p class="collection-desc">{collectionDesc}</p>
		{/if}

		<section class="card-section">
			<h4 class="section-title">{cards.length} card{cards.length !== 1 ? 's' : ''}</h4>
			{#if cards.length === 0}
				<p class="section-empty">No cards found</p>
			{:else}
				<div class="card-list">
					{#each cards.slice(0, visibleCount) as card, i (i)}
						<RemoteCardItem value={card} />
					{/each}
					{#if visibleCount < cards.length}
						<ScrollSentinel onVisible={() => (visibleCount += PAGE_SIZE)} />
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.detail-container {
		padding: var(--space-md);
		max-width: 600px;
	}

	.loading-text {
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.collection-desc {
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
		margin-bottom: var(--space-md);
	}

	.card-section {
		border-top: 1px solid var(--color-border);
		padding-top: var(--space-md);
	}

	.section-title {
		font-size: 0.9375rem;
		font-weight: 600;
		margin-bottom: var(--space-sm);
	}

	.section-empty {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding-bottom: var(--space-md);
	}
</style>
