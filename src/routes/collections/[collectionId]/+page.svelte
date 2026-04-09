<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { updateCollectionInPDS, deleteCollectionFromPDS, createCollectionLinkInPDS, deleteCollectionLinkFromPDS } from '$lib/pds';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardListItem from '$lib/components/cards/CardListItem.svelte';
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
		addSearch = '';
		addSearchFocused = false;
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
		const addedAtMap = new Map(links.map((l) => [l.cardId, new Date(l.addedAt).getTime()]));
		return cards
			.filter((c) => addedAtMap.has(c.cardId))
			.sort((a, b) => (addedAtMap.get(b.cardId)! - addedAtMap.get(a.cardId)!));
	});

	let addSearch = $state('');
	let addSearchFocused = $state(false);
	let addSearchEl: HTMLInputElement | undefined = $state(undefined);
	let addContainerEl: HTMLDivElement | undefined = $state(undefined);

	const MAX_SUGGESTIONS = 10;

	let addSuggestions = $derived.by(() => {
		const cards = $allCards ?? [];
		const memberIds = new Set((cardLinksData ?? []).map((l) => l.cardId));
		const q = addSearch.trim().toLowerCase();

		let results: Array<{ card: import('$lib/types').Card; isMember: boolean }>;

		if (q) {
			results = cards
				.filter((c) => {
					const text = c.type === 'URL' ? `${c.title ?? ''} ${c.url}` : c.text;
					return text.toLowerCase().includes(q);
				})
				.map((c) => ({ card: c, isMember: memberIds.has(c.cardId) }));
		} else {
			// No search query — show most recently created cards
			results = [...cards]
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
				.map((c) => ({ card: c, isMember: memberIds.has(c.cardId) }));
		}

		// Sort: non-members first, then members (greyed out)
		results.sort((a, b) => (a.isMember === b.isMember ? 0 : a.isMember ? 1 : -1));
		return results.slice(0, MAX_SUGGESTIONS);
	});

	function handleAddCardClick(cardId: string, isMember: boolean) {
		if (isMember) return;
		toggleCard(cardId, false);
		addSearch = '';
		addSearchFocused = false;
		addSearchEl?.blur();
	}

	function handleAddSearchClickOutside(e: MouseEvent) {
		if (addContainerEl && !addContainerEl.contains(e.target as Node)) {
			addSearchFocused = false;
		}
	}

	$effect(() => {
		document.addEventListener('mousedown', handleAddSearchClickOutside);
		return () => document.removeEventListener('mousedown', handleAddSearchClickOutside);
	});

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
				<button class="action-btn danger" onclick={() => (confirmDelete = true)}>Delete</button>
			</div>

			<div class="add-card-search" bind:this={addContainerEl}>
				<input
					type="search"
					placeholder="Add to collection..."
					bind:value={addSearch}
					bind:this={addSearchEl}
					onfocus={() => (addSearchFocused = true)}
					class="add-card-input"
				/>
				{#if addSearchFocused}
					<div class="add-card-dropdown">
						{#each addSuggestions as { card, isMember } (card.cardId)}
							<button
								class="add-card-item"
								class:greyed={isMember}
								disabled={isMember}
								onclick={() => handleAddCardClick(card.cardId, isMember)}
							>
								<span class="add-card-item-label">
									{card.type === 'URL' ? (card.title || card.url) : card.text.slice(0, 80)}
								</span>
								{#if isMember}
									<span class="add-card-badge">added</span>
								{/if}
							</button>
						{/each}
						{#if addSuggestions.length === 0}
							<p class="add-card-empty">No cards found</p>
						{/if}
					</div>
				{/if}
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

	.add-card-search {
		position: relative;
		margin-bottom: var(--space-lg);
	}

	.add-card-input {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.875rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.add-card-input:focus {
		border-color: var(--color-primary);
	}

	.add-card-dropdown {
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		margin-top: 2px;
		max-height: 300px;
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 10;
	}

	.add-card-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		font-size: 0.8125rem;
		border-bottom: 1px solid var(--color-border);
		transition: background 0.15s;
		cursor: pointer;
	}

	.add-card-item:last-child {
		border-bottom: none;
	}

	.add-card-item:not(.greyed):hover {
		background: var(--color-bg);
	}

	.add-card-item.greyed {
		opacity: 0.4;
		cursor: default;
	}

	.add-card-item-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.add-card-badge {
		flex-shrink: 0;
		font-size: 0.6875rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.add-card-empty {
		padding: var(--space-md);
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

</style>
