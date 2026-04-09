<script lang="ts">
	import { page } from '$app/stores';
	import { fetchRemoteRecords, fetchRemoteRecord } from '$lib/pds';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import RemoteCardItem from '$lib/components/cards/RemoteCardItem.svelte';
	import ScrollSentinel from '$lib/components/shared/ScrollSentinel.svelte';

	const subject = $derived(decodeURIComponent($page.params.subject!));

	// Parse AT URI: at://did/collection/rkey
	const parsed = $derived.by(() => {
		const parts = subject.replace('at://', '').split('/');
		return {
			repo: parts[0],
			collection: parts.slice(1, -1).join('/'),
			rkey: parts[parts.length - 1]
		};
	});

	const PAGE_SIZE = 20;
	let visibleCount = $state(PAGE_SIZE);

	let collectionName = $state('Collection');
	let collectionDesc = $state<string | undefined>(undefined);
	let cards = $state<Array<Record<string, unknown>>>([]);
	let loading = $state(true);

	$effect(() => {
		const { repo, collection, rkey } = parsed;
		loading = true;
		visibleCount = PAGE_SIZE;
		collectionName = 'Collection';
		collectionDesc = undefined;
		cards = [];

		(async () => {
			// Fetch the collection record for its name
			const colRecord = await fetchRemoteRecord(repo, collection, rkey);
			if (colRecord) {
				collectionName = (colRecord.name as string) || 'Collection';
				collectionDesc = colRecord.description as string | undefined;
			}

			// Only fetch cards for cosmik collections via collectionLink
			if (collection === 'network.cosmik.collection') {
				const linkRecords = await fetchRemoteRecords(repo, 'network.cosmik.collectionLink');
				// Filter links that reference this collection
				const cardRefs = linkRecords
					.filter((r) => {
						const colRef = r.value.collection as Record<string, unknown> | undefined;
						return colRef && (colRef.uri as string) === subject;
					})
					.map((r) => {
						const cardRef = r.value.card as Record<string, unknown>;
						return cardRef.uri as string;
					});

				// Fetch each card record
				const cardResults = await Promise.all(
					cardRefs.map(async (cardUri) => {
						const parts = cardUri.replace('at://', '').split('/');
						const cardRepo = parts[0];
						const cardCollection = parts.slice(1, -1).join('/');
						const cardRkey = parts[parts.length - 1];
						return fetchRemoteRecord(cardRepo, cardCollection, cardRkey);
					})
				);
				cards = cardResults.filter((c): c is Record<string, unknown> => c !== null);
			}

			loading = false;
		})();
	});
</script>

<PageHeader title={collectionName} />

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
