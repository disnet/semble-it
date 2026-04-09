<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { createCollectionLinkInPDS, deleteCollectionLinkFromPDS } from '$lib/pds';
	import type { Card } from '$lib/types';
	import CollectionPicker from '$lib/components/collections/CollectionPicker.svelte';

	let { cardId, card }: { cardId: string; card: Card } = $props();

	const collections = liveQuery(() => db.collections.toArray());

	const cardCollections = liveQuery(() =>
		db.collectionCards.where('cardId').equals(cardId).toArray()
	);

	let addToCollection = $state<string | undefined>(undefined);

	let memberCollectionIds = $derived(
		($cardCollections ?? []).map((cc) => cc.collectionId)
	);

	$effect(() => {
		if (!addToCollection) return;
		const colId = addToCollection;
		addToCollection = undefined;
		toggleCollection(colId, false);
	});

	async function toggleCollection(colId: string, isMember: boolean) {
		if (isMember) {
			const ccLink = ($cardCollections ?? []).find((cc) => cc.collectionId === colId);
			if (auth.session && ccLink) await deleteCollectionLinkFromPDS(auth.session, ccLink);
			await db.collectionCards.where('[collectionId+cardId]').equals([colId, cardId]).delete();
		} else {
			const col = ($collections ?? []).find((col) => col.collectionId === colId);
			const cc = { collectionId: colId, cardId, addedAt: new Date() } as import('$lib/types').CollectionCard;
			if (auth.session && card && col) {
				const ref = await createCollectionLinkInPDS(auth.session, card, col);
				cc.uri = ref.uri;
				cc.cid = ref.cid;
			}
			await db.collectionCards.add(cc);
		}
	}
</script>

<section class="section">
	<div class="section-header">
		<h4 class="section-title">Collections</h4>
	</div>
	<div class="collection-picker-wrap">
		<CollectionPicker bind:selected={addToCollection} excludeIds={memberCollectionIds} />
	</div>
	{#if ($cardCollections ?? []).length === 0}
		<p class="section-empty">Not in any collections</p>
	{:else}
		<div class="tag-list">
			{#each $cardCollections ?? [] as cc}
				{@const col = ($collections ?? []).find((c) => c.collectionId === cc.collectionId)}
				{#if col}
					<span class="tag-with-remove">
						<a href="/collections/{col.collectionId}" class="tag">{col.name}</a>
						<button class="tag-remove" onclick={() => toggleCollection(col.collectionId, true)} title="Remove from collection">&times;</button>
					</span>
				{/if}
			{/each}
		</div>
	{/if}
</section>

<style>
	.section {
		margin-top: var(--space-lg);
		padding-top: var(--space-lg);
		border-top: 1px solid var(--color-border);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-sm);
	}

	.section-title {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.section-empty {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.collection-picker-wrap {
		margin-bottom: var(--space-sm);
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.tag {
		padding: 4px 12px;
		background: var(--color-primary-light);
		color: var(--color-primary);
		border-radius: var(--radius-full);
		font-size: 0.8125rem;
		font-weight: 500;
		text-decoration: none;
	}

	.tag-with-remove {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		background: var(--color-primary-light);
		border-radius: var(--radius-full);
		padding-right: 4px;
	}

	.tag-with-remove .tag {
		background: none;
		padding-right: 2px;
	}

	.tag-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		color: var(--color-primary);
		transition: background 0.15s, color 0.15s;
		cursor: pointer;
	}

	.tag-remove:hover {
		background: rgba(0, 0, 0, 0.1);
		color: var(--color-danger);
	}
</style>
