<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardListItem from '$lib/components/cards/CardListItem.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';

	const collectionId = $derived($page.params.collectionId);

	const collection = liveQuery(() => db.collections.get(collectionId));

	const cardLinks = liveQuery(() =>
		db.collectionCards.where('collectionId').equals(collectionId).toArray()
	);

	const allCards = liveQuery(() => db.cards.toArray());

	let memberCards = $derived.by(() => {
		const links = $cardLinks ?? [];
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
		if (!$collection) return;
		editName = $collection.name;
		editDescription = $collection.description ?? '';
		editing = true;
	}

	async function saveEdit() {
		if (!editName.trim()) return;
		await db.collections.update(collectionId, {
			name: editName.trim(),
			description: editDescription.trim() || undefined,
			updatedAt: new Date()
		});
		editing = false;
	}

	async function deleteCollection() {
		await db.transaction('rw', [db.collections, db.collectionCards], async () => {
			await db.collections.delete(collectionId);
			await db.collectionCards.where('collectionId').equals(collectionId).delete();
		});
		goto('/cards');
	}

	async function toggleCard(cardId: string, isMember: boolean) {
		if (isMember) {
			await db.collectionCards.where('[collectionId+cardId]').equals([collectionId, cardId]).delete();
		} else {
			await db.collectionCards.add({ collectionId, cardId, addedAt: new Date() });
		}
	}
</script>

<PageHeader title={$collection?.name ?? 'Collection'} />

{#if $collection}
	<div class="detail-container">
		{#if !editing}
			{#if $collection.description}
				<p class="collection-desc">{$collection.description}</p>
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
					{#each memberCards as card (card.cardId)}
						<CardListItem {card} />
					{/each}
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
					{@const isMember = ($cardLinks ?? []).some((l) => l.cardId === card.cardId)}
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
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="confirm-overlay" onclick={() => (confirmDelete = false)} onkeydown={() => {}}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="confirm-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
				<p class="confirm-text">Delete this collection? Cards won't be deleted.</p>
				<div class="confirm-actions">
					<button class="action-btn" onclick={() => (confirmDelete = false)}>Cancel</button>
					<button class="action-btn danger" onclick={deleteCollection}>Delete</button>
				</div>
			</div>
		</div>
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
		padding-bottom: calc(var(--fab-size) + var(--space-xl) * 2);
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

	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 300;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-md);
	}

	.confirm-dialog {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		max-width: 360px;
		width: 100%;
		box-shadow: var(--shadow-lg);
	}

	.confirm-text {
		font-size: 0.9375rem;
		line-height: 1.5;
		margin-bottom: var(--space-md);
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
	}
</style>
