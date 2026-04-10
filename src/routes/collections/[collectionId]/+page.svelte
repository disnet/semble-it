<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { syncFromPDS, resolveFollowMetadata } from '$lib/pds';
	import { queueUpdateCollection, queueDeleteCollection, queueCreateCollectionLink, queueDeleteCollectionLink } from '$lib/writeQueue';
	import type { CardType } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import RefreshBar from '$lib/components/shared/RefreshBar.svelte';
	import CardFilterBar from '$lib/components/cards/CardFilterBar.svelte';
	import CardListItem from '$lib/components/cards/CardListItem.svelte';
	import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte';
	import ScrollSentinel from '$lib/components/shared/ScrollSentinel.svelte';
	import { Ellipsis, Plus } from 'lucide-svelte';

	const PAGE_SIZE = 20;
	type FilterValue = CardType | 'ALL';
	type SortValue = 'newest' | 'oldest';
	let filter: FilterValue = $state('ALL');
	let sort: SortValue = $state('newest');
	let search = $state('');
	let visibleCount = $state(PAGE_SIZE);

	const collectionId = $derived($page.params.collectionId!);

	let collectionData = $state<import('$lib/types').Collection | undefined>(undefined);
	let cardLinksData = $state<import('$lib/types').CollectionCard[]>([]);
	const allCards = liveQuery(() => db.cards.toArray());

	$effect(() => {
		const id = collectionId;
		visibleCount = PAGE_SIZE;
		filter = 'ALL';
		sort = 'newest';
		search = '';
		addSearch = '';
		addSearchFocused = false;
		editing = false;
		confirmDelete = false;
		moreOpen = false;

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

	let filteredMemberCards = $derived.by(() => {
		let cards = memberCards;
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

	let moreOpen = $state(false);
	let moreContainerEl: HTMLDivElement | undefined = $state(undefined);

	function handleMoreClickOutside(e: MouseEvent) {
		if (moreContainerEl && !moreContainerEl.contains(e.target as Node)) {
			moreOpen = false;
		}
	}

	$effect(() => {
		document.addEventListener('mousedown', handleMoreClickOutside);
		return () => document.removeEventListener('mousedown', handleMoreClickOutside);
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
		await queueUpdateCollection(updated);
		editing = false;
	}

	async function deleteCollection() {
		if (collectionData) {
			await queueDeleteCollection(collectionData);
		}
		goto('/cards');
	}

	async function handleRefresh() {
		if (!auth.session) return;
		await syncFromPDS(auth.session);
		resolveFollowMetadata(auth.session).catch(console.error);
	}

	async function toggleCard(cardId: string, isMember: boolean) {
		if (isMember) {
			const ccLink = (cardLinksData ?? []).find((l) => l.cardId === cardId);
			if (ccLink) await queueDeleteCollectionLink(ccLink);
		} else {
			await queueCreateCollectionLink(cardId, collectionId);
		}
	}
</script>

<PageHeader title={collectionData?.name ?? 'Collection'} pickable>
	{#snippet actions()}
		<span class="header-card-count">{memberCards.length} card{memberCards.length !== 1 ? 's' : ''}</span>
		<div class="more-container" bind:this={moreContainerEl}>
			<button class="more-btn" onclick={() => (moreOpen = !moreOpen)}>
				<Ellipsis size={20} />
			</button>
			{#if moreOpen}
				<div class="more-popup">
					<button class="more-item" onclick={() => { moreOpen = false; startEdit(); }}>Edit</button>
					<button class="more-item danger" onclick={() => { moreOpen = false; confirmDelete = true; }}>Delete</button>
				</div>
			{/if}
		</div>
	{/snippet}
</PageHeader>
<RefreshBar cacheKey="pds-sync" onrefresh={handleRefresh} />

{#if collectionData}
	<div class="detail-container">
		{#if !editing}
			{#if collectionData.description}
				<p class="collection-desc">{collectionData.description}</p>
			{/if}

			<div class="toolbar">
				<CardFilterBar bind:filter bind:sort />
				<input type="search" placeholder="Search cards…" bind:value={search} class="toolbar-search" />
				<div class="add-card-search" bind:this={addContainerEl}>
					<button class="add-btn" onclick={() => { addSearchFocused = !addSearchFocused; if (!addSearchFocused) { addSearch = ''; } else { setTimeout(() => addSearchEl?.focus(), 0); } }}>
						<Plus size={18} />
					</button>
					{#if addSearchFocused}
						<div class="add-card-dropdown">
							<input
								type="search"
								placeholder="Add card..."
								bind:value={addSearch}
								bind:this={addSearchEl}
								class="add-card-input"
							/>
							<div class="add-card-list">
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
						</div>
					{/if}
				</div>
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
			{#if filteredMemberCards.length === 0}
				<p class="section-empty">{memberCards.length === 0 ? 'No cards in this collection yet' : 'No cards match your filters'}</p>
			{:else}
				<div class="card-list">
					{#each filteredMemberCards.slice(0, visibleCount) as card (card.cardId)}
						<CardListItem {card} />
					{/each}
					{#if visibleCount < filteredMemberCards.length}
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
	}

	.collection-desc {
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
		margin-bottom: var(--space-md);
	}

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

	.more-container {
		position: relative;
		flex-shrink: 0;
	}

	.more-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: background 0.15s;
	}

	.more-btn:hover {
		background: var(--color-bg);
	}

	.more-popup {
		position: absolute;
		right: 0;
		top: 100%;
		margin-top: 4px;
		min-width: 120px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 20;
		overflow: hidden;
	}

	.more-item {
		display: block;
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.more-item:hover {
		background: var(--color-bg);
	}

	.more-item.danger {
		color: var(--color-danger);
	}

	.more-item.danger:hover {
		background: var(--color-danger-light);
	}

	.card-section {
	}

	.header-card-count {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		font-weight: 500;
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

	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.toolbar-search {
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

	.toolbar-search:focus {
		border-color: var(--color-primary);
	}

	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		color: white;
		border: none;
		cursor: pointer;
		flex-shrink: 0;
		transition: opacity 0.15s;
	}

	.add-btn:hover {
		opacity: 0.85;
	}

	.add-card-search {
		position: relative;
	}

	.add-card-input {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: none;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 0.875rem;
		outline: none;
	}

	.add-card-input:focus {
		border-bottom-color: var(--color-primary);
	}

	.add-card-dropdown {
		position: absolute;
		right: 0;
		top: 100%;
		margin-top: 6px;
		width: 280px;
		max-height: 340px;
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 8px);
		background: var(--color-surface);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		z-index: 100;
	}

	.add-card-list {
		max-height: 280px;
		overflow-y: auto;
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
