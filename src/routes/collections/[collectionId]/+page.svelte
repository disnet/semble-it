<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { updateCollectionInPDS, deleteCollectionFromPDS, createCollectionLinkInPDS, deleteCollectionLinkFromPDS } from '$lib/pds';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardListItem from '$lib/components/cards/CardListItem.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte';
	import ScrollSentinel from '$lib/components/shared/ScrollSentinel.svelte';

	const PAGE_SIZE = 20;
	let visibleCount = $state(PAGE_SIZE);

	const collectionId = $derived($page.params.collectionId!);

	let collectionData = $state<import('$lib/types').Collection | undefined>(undefined);
	let cardLinksData = $state<import('$lib/types').CollectionCard[]>([]);
	const allCards = liveQuery(() => db.cards.toArray());

	$effect(() => {
		const id = collectionId;
		visibleCount = PAGE_SIZE;
		showAddCards = false;
		editing = false;
		confirmDelete = false;

		const sub1 = liveQuery(() => db.collections.get(id)).subscribe((val) => {
			collectionData = val;
		});
		const sub2 = liveQuery(() =>
			db.collectionCards.where('collectionId').equals(id).toArray()
		).subscribe((val) => {
			cardLinksData = val;
		});

		return () => {
			sub1.unsubscribe();
			sub2.unsubscribe();
		};
	});

	let memberCards = $derived.by(() => {
		const links = cardLinksData;
		const cards = $allCards ?? [];
		const memberIds = new Set(links.map((l) => l.cardId));
		return cards.filter((c) => memberIds.has(c.cardId));
	});

	let showAddCards = $state(false);
	let editing = $state(false);
	let editName = $state('');
	let editDescription = $state('');
	let confirmDelete = $state(false);

	function startEdit() {
		if (!collectionData) return;
		editName = collectionData.name;
		editDescription = collectionData.description ?? '';
		editing = true;
	}

	async function saveEdit() {
		if (!editName.trim() || !collectionData) return;
		const updated = {
			...collectionData,
			name: editName.trim(),
			description: editDescription.trim() || undefined,
			updatedAt: new Date()
		};
		if (auth.session) await updateCollectionInPDS(auth.session, updated);
		await db.collections.put(updated);
		editing = false;
	}

	async function deleteCollection() {
		if (auth.session && collectionData) {
			const ccLinks = await db.collectionCards.where('collectionId').equals(collectionId).toArray();
			await Promise.all([
				deleteCollectionFromPDS(auth.session, collectionData),
				...ccLinks.map((cc) => deleteCollectionLinkFromPDS(auth.session!, cc))
			]);
		}
		await db.transaction('rw', [db.collections, db.collectionCards], async () => {
			await db.collections.delete(collectionId);
			await db.collectionCards.where('collectionId').equals(collectionId).delete();
		});
		goto('/cards');
	}

	async function toggleCard(cardId: string, isMember: boolean) {
		if (isMember) {
			const ccLink = (cardLinksData ?? []).find((l) => l.cardId === cardId);
			if (auth.session && ccLink) await deleteCollectionLinkFromPDS(auth.session, ccLink);
			await db.collectionCards.where('[collectionId+cardId]').equals([collectionId, cardId]).delete();
		} else {
			const card = ($allCards ?? []).find((c) => c.cardId === cardId);
			const col = collectionData;
			const cc = { collectionId, cardId, addedAt: new Date() } as import('$lib/types').CollectionCard;
			if (auth.session && card && col) {
				const ref = await createCollectionLinkInPDS(auth.session, card, col);
				cc.uri = ref.uri;
				cc.cid = ref.cid;
			}
			await db.collectionCards.add(cc);
		}
	}
</script>

<PageHeader title={collectionData?.name ?? 'Collection'} />

{#if collectionData}
	<div class="detail-container">
		{#if !editing}
			{#if collectionData.description}
				<p class="collection-desc">{collectionData.description}</p>
			{/if}

			<div class="actions">
				<button class="action-btn" onclick={startEdit}>Edit</button>
				<button class="action-btn" onclick={() => (showAddCards = true)}>Add Cards</button>
				<button class="action-btn danger" onclick={() => (confirmDelete = true)}>Delete</button>
			</div>
		{:else}
			<div class="edit-form">
				<label class="field">
					<span class="field-label">Name</span>
					<input type="text" bind:value={editName} class="field-input" />
				</label>
				<label class="field">
					<span class="field-label">Description</span>
					<textarea bind:value={editDescription} class="field-textarea" rows="3"></textarea>
				</label>
				<div class="edit-actions">
					<button class="action-btn" onclick={saveEdit}>Save</button>
					<button class="action-btn" onclick={() => (editing = false)}>Cancel</button>
				</div>
			</div>
		{/if}

		<section class="card-section">
			<h4 class="section-title">{memberCards.length} card{memberCards.length !== 1 ? 's' : ''}</h4>
			{#if memberCards.length === 0}
				<p class="section-empty">No cards in this collection yet</p>
			{:else}
				<div class="card-list">
					{#each memberCards.slice(0, visibleCount) as card (card.cardId)}
						<CardListItem {card} />
					{/each}
					{#if visibleCount < memberCards.length}
						<ScrollSentinel onVisible={() => (visibleCount += PAGE_SIZE)} />
					{/if}
				</div>
			{/if}
		</section>
	</div>

	<!-- Add cards bottom sheet -->
	<BottomSheet bind:open={showAddCards} title="Add Cards">
		{#if ($allCards ?? []).length === 0}
			<p class="section-empty">No cards yet. Create some first!</p>
		{:else}
			<div class="collection-checks">
				{#each $allCards ?? [] as card}
					{@const isMember = (cardLinksData ?? []).some((l) => l.cardId === card.cardId)}
					<label class="check-item">
						<input
							type="checkbox"
							checked={isMember}
							onchange={() => toggleCard(card.cardId, isMember)}
						/>
						<span class="check-label">
							{card.type === 'URL' ? (card.title || card.url) : card.text.slice(0, 60)}
						</span>
					</label>
				{/each}
			</div>
		{/if}
	</BottomSheet>

	{#if confirmDelete}
		<ConfirmDialog
			message="Delete this collection? Cards won't be deleted."
			onconfirm={deleteCollection}
			oncancel={() => (confirmDelete = false)}
		/>
	{/if}
{:else}
	<div class="detail-container">
		<p>Collection not found.</p>
	</div>
{/if}

<style>
	.detail-container {
		padding: var(--space-md);
		max-width: 600px;
	}

	.collection-desc {
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
		margin-bottom: var(--space-md);
	}

	.actions,
	.edit-actions {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-lg);
	}

	.action-btn {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
		transition: background 0.15s;
	}

	.action-btn:hover {
		background: var(--color-bg);
	}

	.action-btn.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}

	.action-btn.danger:hover {
		background: var(--color-danger-light);
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

	.edit-form {
		margin-bottom: var(--space-lg);
	}

	.field {
		display: block;
		margin-bottom: var(--space-md);
	}

	.field-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-xs);
	}

	.field-input,
	.field-textarea {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.9375rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.field-input:focus,
	.field-textarea:focus {
		border-color: var(--color-primary);
	}

	.field-textarea {
		resize: vertical;
	}

	.collection-checks {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.check-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: 0.9375rem;
		cursor: pointer;
	}

	.check-item input[type='checkbox'] {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		accent-color: var(--color-primary);
	}

	.check-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

</style>
