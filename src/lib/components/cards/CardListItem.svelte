<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import {
		updateCardInPDS,
		deleteCardFromPDS,
		deleteCollectionLinkFromPDS,
		deleteConnectionFromPDS
	} from '$lib/pds';
	import type { Card } from '$lib/types';
	import { formatDate } from '$lib/utils';
	import CardTypeBadge from './CardTypeBadge.svelte';
	import CardCollections from './CardCollections.svelte';
	import CardConnections from './CardConnections.svelte';
	import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte';

	let { card }: { card: Card } = $props();

	let expanded = $state(false);
	let confirmDelete = $state(false);

	// Edit fields
	let editUrl = $state('');
	let editTitle = $state('');
	let editDescription = $state('');
	let editText = $state('');

	function getTitle(card: Card): string {
		switch (card.type) {
			case 'URL':
				return card.title || card.url;
			case 'NOTE':
				return card.text.slice(0, 100);
		}
	}

	function getSubtitle(card: Card): string {
		switch (card.type) {
			case 'URL':
				return card.description || card.url;
			case 'NOTE':
				return card.text.length > 100 ? card.text.slice(100, 200) + '…' : '';
		}
	}

	function toggleExpanded() {
		if (!expanded) {
			// Initialize edit fields when expanding
			if (card.type === 'URL') {
				editUrl = card.url;
				editTitle = card.title ?? '';
				editDescription = card.description ?? '';
			} else if (card.type === 'NOTE') {
				editText = card.text;
			}
		}
		expanded = !expanded;
	}

	async function saveEdit() {
		const now = new Date();
		let updated: Card;
		if (card.type === 'URL') {
			updated = {
				...card,
				url: editUrl.trim(),
				title: editTitle.trim() || undefined,
				description: editDescription.trim() || undefined,
				updatedAt: now
			};
		} else {
			updated = { ...card, text: editText.trim(), updatedAt: now };
		}

		if (auth.session) await updateCardInPDS(auth.session, updated);
		await db.cards.put(updated);
		expanded = false;
	}

	async function deleteCard() {
		if (auth.session) {
			const [ccLinks, srcConns, tgtConns] = await Promise.all([
				db.collectionCards.where('cardId').equals(card.cardId).toArray(),
				db.connections.where('sourceCardId').equals(card.cardId).toArray(),
				db.connections.where('targetCardId').equals(card.cardId).toArray()
			]);
			await Promise.all([
				deleteCardFromPDS(auth.session, card),
				...ccLinks.map((cc) => deleteCollectionLinkFromPDS(auth.session!, cc)),
				...srcConns.map((conn) => deleteConnectionFromPDS(auth.session!, conn)),
				...tgtConns.map((conn) => deleteConnectionFromPDS(auth.session!, conn))
			]);
		}
		await db.transaction('rw', [db.cards, db.collectionCards, db.connections], async () => {
			await db.cards.delete(card.cardId);
			await db.collectionCards.where('cardId').equals(card.cardId).delete();
			await db.connections.where('sourceCardId').equals(card.cardId).delete();
			await db.connections.where('targetCardId').equals(card.cardId).delete();
		});
	}
</script>

<div class="card-item" class:expanded class:has-image={!expanded && card.type === 'URL' && card.imageUrl}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="card-summary" onclick={toggleExpanded} onkeydown={(e) => { if (e.key === 'Enter') toggleExpanded(); }}>
		{#if !expanded && card.type === 'URL' && card.imageUrl}
			<img src={card.imageUrl} alt="" class="card-image" />
		{/if}
		<div class="card-item-body">
			<div class="card-item-header">
				<CardTypeBadge type={card.type} />
				<span class="card-date">{formatDate(card.createdAt, 'short')}</span>
			</div>
			<div class="card-title">{getTitle(card)}</div>
			{#if !expanded && getSubtitle(card)}
				<div class="card-subtitle">{getSubtitle(card)}</div>
			{/if}
		</div>
	</div>

	{#if expanded}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="card-expanded" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<div class="edit-form">
				{#if card.type === 'URL'}
					<label class="field">
						<span class="field-label">Title</span>
						<input type="text" bind:value={editTitle} class="field-input" />
					</label>
					<label class="field">
						<span class="field-label">URL</span>
						<input type="url" bind:value={editUrl} class="field-input" />
					</label>
				{:else if card.type === 'NOTE'}
					<label class="field">
						<span class="field-label">Note</span>
						<textarea bind:value={editText} class="field-textarea" rows="4"></textarea>
					</label>
				{/if}
				<div class="edit-actions">
					<button class="action-btn primary" onclick={saveEdit}>Save</button>
					<button class="action-btn" onclick={() => (expanded = false)}>Cancel</button>
					<button class="action-btn danger" onclick={() => (confirmDelete = true)}>Delete</button>
				</div>
			</div>

			<CardCollections cardId={card.cardId} {card} />
			<CardConnections cardId={card.cardId} />
		</div>
	{/if}
</div>

{#if confirmDelete}
	<ConfirmDialog
		message="Delete this card? This will also remove it from all collections and delete its connections."
		onconfirm={deleteCard}
		oncancel={() => (confirmDelete = false)}
	/>
{/if}

<style>
	.card-item {
		background: var(--color-surface);
		border-radius: var(--radius-md);
		color: var(--color-text);
		box-shadow: var(--shadow-sm);
		transition: box-shadow 0.15s;
	}

	.card-item:hover {
		box-shadow: var(--shadow-md);
	}

	.card-item.expanded {
		box-shadow: var(--shadow-md);
	}

	.card-summary {
		display: block;
		padding: var(--space-md);
		cursor: pointer;
		-webkit-user-select: none;
		user-select: none;
	}

	.card-item.has-image .card-summary {
		display: flex;
		align-items: stretch;
		gap: var(--space-md);
	}

	.card-image {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}

	.card-item-body {
		flex: 1;
		min-width: 0;
	}

	.card-item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-xs);
	}

	.card-date {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.card-title {
		font-weight: 500;
		font-size: 0.9375rem;
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-subtitle {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-expanded {
		padding: 0 var(--space-md) var(--space-md);
	}

	.edit-form {
		margin-bottom: var(--space-sm);
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

	.edit-actions {
		display: flex;
		gap: var(--space-sm);
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

	.action-btn.primary {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.action-btn.primary:hover {
		opacity: 0.9;
	}

	.action-btn.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
		margin-left: auto;
	}

	.action-btn.danger:hover {
		background: var(--color-danger-light);
	}
</style>
