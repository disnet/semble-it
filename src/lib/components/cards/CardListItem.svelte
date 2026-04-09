<script lang="ts">
	import { goto } from '$app/navigation';
	import { queueUpdateCard, queueDeleteCard } from '$lib/writeQueue';
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

	function getDomain(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
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
				title: editTitle.trim() || undefined,
				description: editDescription.trim() || undefined,
				updatedAt: now
			};
		} else {
			updated = { ...card, text: editText.trim(), updatedAt: now };
		}

		await queueUpdateCard(updated);
	}

	async function deleteCard() {
		await queueDeleteCard(card);
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
				{#if card.type === 'URL'}
					<a href={card.url} target="_blank" rel="noopener noreferrer" class="url-domain" onclick={(e) => e.stopPropagation()}>
						{getDomain(card.url)}
						<svg class="url-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7" /><path d="M13 3L3 13" /></svg>
					</a>
				{/if}
				<span class="card-header-right">
					{#if expanded}
						<button class="delete-btn" onclick={(e) => { e.stopPropagation(); confirmDelete = true; }}>
							<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M12 4v9.33a1.33 1.33 0 01-1.33 1.34H5.33A1.33 1.33 0 014 13.33V4" /></svg>
						</button>
					{/if}
					<span class="card-date">{formatDate(card.createdAt, 'short')}</span>
				</span>
			</div>
			{#if !expanded}
				<div class="card-title">{getTitle(card)}</div>
				{#if getSubtitle(card)}
					<div class="card-subtitle">{getSubtitle(card)}</div>
				{/if}
			{/if}
		</div>
	</div>

	{#if expanded}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="card-expanded" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<div class="edit-form">
				{#if card.type === 'URL'}
					<input type="text" bind:value={editTitle} class="field-input" placeholder="Title" onblur={saveEdit} />
				{:else if card.type === 'NOTE'}
					<textarea bind:value={editText} class="field-textarea" rows="4" placeholder="Note" onblur={saveEdit}></textarea>
				{/if}
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
		gap: var(--space-sm);
		margin-bottom: var(--space-xs);
	}

	.card-header-right {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin-left: auto;
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

	.url-domain {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.url-domain:hover {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.url-arrow {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
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

	.delete-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-text-secondary);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: color 0.15s, background 0.15s;
	}

	.delete-btn:hover {
		color: var(--color-danger);
		background: var(--color-danger-light);
	}

	.delete-btn svg {
		width: 14px;
		height: 14px;
	}
</style>
