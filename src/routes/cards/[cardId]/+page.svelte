<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { updateCardInPDS, deleteCardFromPDS, deleteCollectionLinkFromPDS, deleteConnectionFromPDS } from '$lib/pds';
	import type { Card } from '$lib/types';
	import { formatDate } from '$lib/utils';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardTypeBadge from '$lib/components/cards/CardTypeBadge.svelte';
	import CardCollections from '$lib/components/cards/CardCollections.svelte';
	import CardConnections from '$lib/components/cards/CardConnections.svelte';
	import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte';

	const cardId = $derived($page.params.cardId!);

	const card = liveQuery(() => db.cards.get(cardId));

	let editing = $state(false);
	let confirmDelete = $state(false);

	// Edit fields
	let editUrl = $state('');
	let editTitle = $state('');
	let editDescription = $state('');
	let editText = $state('');

	function startEdit(c: Card) {
		editing = true;
		if (c.type === 'URL') {
			editUrl = c.url;
			editTitle = c.title ?? '';
			editDescription = c.description ?? '';
		} else if (c.type === 'NOTE') {
			editText = c.text;
		}
	}

	async function saveEdit() {
		const c = $card;
		if (!c) return;
		const now = new Date();

		let updated: Card;
		if (c.type === 'URL') {
			updated = { ...c, url: editUrl.trim(), title: editTitle.trim() || undefined, description: editDescription.trim() || undefined, updatedAt: now };
		} else {
			updated = { ...c, text: editText.trim(), updatedAt: now };
		}

		if (auth.session) await updateCardInPDS(auth.session, updated);
		await db.cards.put(updated);
		editing = false;
	}

	async function deleteCard() {
		const c = $card;
		if (auth.session && c) {
			const [ccLinks, srcConns, tgtConns] = await Promise.all([
				db.collectionCards.where('cardId').equals(cardId).toArray(),
				db.connections.where('sourceCardId').equals(cardId).toArray(),
				db.connections.where('targetCardId').equals(cardId).toArray()
			]);
			await Promise.all([
				deleteCardFromPDS(auth.session, c),
				...ccLinks.map((cc) => deleteCollectionLinkFromPDS(auth.session!, cc)),
				...srcConns.map((conn) => deleteConnectionFromPDS(auth.session!, conn)),
				...tgtConns.map((conn) => deleteConnectionFromPDS(auth.session!, conn))
			]);
		}
		await db.transaction('rw', [db.cards, db.collectionCards, db.connections], async () => {
			await db.cards.delete(cardId);
			await db.collectionCards.where('cardId').equals(cardId).delete();
			await db.connections.where('sourceCardId').equals(cardId).delete();
			await db.connections.where('targetCardId').equals(cardId).delete();
		});
		goto('/cards');
	}
</script>

<PageHeader title={$card ? ($card.type === 'URL' ? ($card.title || 'URL Card') : 'Note') : 'Card'} />

{#if $card}
	<div class="detail-container">
		{#if !editing}
			<div class="card-meta">
				<CardTypeBadge type={$card.type} />
				<span class="card-date">{formatDate($card.createdAt)}</span>
			</div>

			{#if $card.type === 'URL'}
				<div class="card-url-header" class:has-image={!!$card.imageUrl}>
					{#if $card.imageUrl}
						<img src={$card.imageUrl} alt="" class="card-image" />
					{/if}
					<div class="card-url-info">
						<h3 class="card-title">{$card.title || 'Untitled'}</h3>
						<a href={$card.url} target="_blank" rel="noopener" class="card-url">{$card.url}</a>
					</div>
				</div>
				{#if $card.description}
					<p class="card-description">{$card.description}</p>
				{/if}
			{:else if $card.type === 'NOTE'}
				<p class="card-text">{$card.text}</p>
			{/if}

			<div class="actions">
				<button class="action-btn" onclick={() => startEdit($card!)}>Edit</button>
				<button class="action-btn danger" onclick={() => (confirmDelete = true)}>Delete</button>
			</div>
		{:else}
			<div class="edit-form">
				{#if $card.type === 'URL'}
					<label class="field">
						<span class="field-label">URL</span>
						<input type="url" bind:value={editUrl} class="field-input" />
					</label>
					<label class="field">
						<span class="field-label">Title</span>
						<input type="text" bind:value={editTitle} class="field-input" />
					</label>
					<label class="field">
						<span class="field-label">Description</span>
						<textarea bind:value={editDescription} class="field-textarea" rows="3"></textarea>
					</label>
				{:else if $card.type === 'NOTE'}
					<label class="field">
						<span class="field-label">Note</span>
						<textarea bind:value={editText} class="field-textarea" rows="6"></textarea>
					</label>
				{/if}
				<div class="edit-actions">
					<button class="action-btn" onclick={saveEdit}>Save</button>
					<button class="action-btn" onclick={() => (editing = false)}>Cancel</button>
				</div>
			</div>
		{/if}

		<CardCollections {cardId} card={$card} />
		<CardConnections {cardId} />
	</div>

	{#if confirmDelete}
		<ConfirmDialog
			message="Delete this card? This will also remove it from all collections and delete its connections."
			onconfirm={deleteCard}
			oncancel={() => (confirmDelete = false)}
		/>
	{/if}
{:else}
	<div class="detail-container">
		<p>Card not found.</p>
	</div>
{/if}

<style>
	.detail-container {
		padding: var(--space-md);
		max-width: 600px;
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.card-date {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.card-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: var(--space-xs);
	}

	.card-url-header {
		margin-bottom: var(--space-sm);
	}

	.card-url-header.has-image {
		display: flex;
		align-items: flex-start;
		gap: var(--space-md);
	}

	.card-image {
		width: 80px;
		height: 80px;
		flex-shrink: 0;
		object-fit: cover;
		border-radius: var(--radius-md);
	}

	.card-url-info {
		flex: 1;
		min-width: 0;
	}

	.card-url {
		display: block;
		font-size: 0.8125rem;
		color: var(--color-primary);
		margin-bottom: var(--space-sm);
		word-break: break-all;
	}

	.card-description,
	.card-text {
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--color-text);
		margin-bottom: var(--space-md);
	}

	.actions,
	.edit-actions {
		display: flex;
		gap: var(--space-sm);
		margin: var(--space-md) 0;
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

	.edit-form {
		margin-bottom: var(--space-md);
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
</style>
