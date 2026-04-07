<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { updateCardInPDS, deleteCardFromPDS, createCollectionLinkInPDS, deleteCollectionLinkFromPDS, deleteConnectionFromPDS } from '$lib/pds';
	import type { Card } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardTypeBadge from '$lib/components/cards/CardTypeBadge.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';

	const cardId = $derived($page.params.cardId!);

	const card = liveQuery(() => db.cards.get(cardId));

	const collections = liveQuery(() => db.collections.toArray());

	const cardCollections = liveQuery(() =>
		db.collectionCards.where('cardId').equals(cardId).toArray()
	);

	const cardConnections = liveQuery(async () => {
		const [asSource, asTarget] = await Promise.all([
			db.connections.where('sourceCardId').equals(cardId).toArray(),
			db.connections.where('targetCardId').equals(cardId).toArray()
		]);
		return { asSource, asTarget };
	});

	// For resolving card names in connections
	const allCards = liveQuery(() => db.cards.toArray());

	let showCollections = $state(false);
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

	async function toggleCollection(colId: string, isMember: boolean) {
		if (isMember) {
			const ccLink = ($cardCollections ?? []).find((cc) => cc.collectionId === colId);
			if (auth.session && ccLink) await deleteCollectionLinkFromPDS(auth.session, ccLink);
			await db.collectionCards.where('[collectionId+cardId]').equals([colId, cardId]).delete();
		} else {
			const c = $card;
			const col = ($collections ?? []).find((col) => col.collectionId === colId);
			const cc = { collectionId: colId, cardId, addedAt: new Date() } as import('$lib/types').CollectionCard;
			if (auth.session && c && col) {
				const ref = await createCollectionLinkInPDS(auth.session, c, col);
				cc.uri = ref.uri;
				cc.cid = ref.cid;
			}
			await db.collectionCards.add(cc);
		}
	}

	function isUrl(value: string): boolean {
		return value.startsWith('http://') || value.startsWith('https://');
	}

	function getEndpointName(value: string): string {
		if (isUrl(value)) {
			try {
				const u = new URL(value);
				return u.hostname.replace(/^www\./, '');
			} catch {
				return value;
			}
		}
		const cards = $allCards ?? [];
		const c = cards.find((c) => c.cardId === value);
		if (!c) return value.slice(0, 8) + '…';
		if (c.type === 'URL') return c.title || c.url;
		return c.text.slice(0, 50);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
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
				<h3 class="card-title">{$card.title || 'Untitled'}</h3>
				<a href={$card.url} target="_blank" rel="noopener" class="card-url">{$card.url}</a>
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
			<!-- Edit form -->
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

		<!-- Collections section -->
		<section class="section">
			<div class="section-header">
				<h4 class="section-title">Collections</h4>
				<button class="section-action" onclick={() => (showCollections = true)}>Manage</button>
			</div>
			{#if ($cardCollections ?? []).length === 0}
				<p class="section-empty">Not in any collections</p>
			{:else}
				<div class="tag-list">
					{#each $cardCollections ?? [] as cc}
						{@const col = ($collections ?? []).find((c) => c.collectionId === cc.collectionId)}
						{#if col}
							<a href="/collections/{col.collectionId}" class="tag">{col.name}</a>
						{/if}
					{/each}
				</div>
			{/if}
		</section>

		<!-- Connections section -->
		<section class="section">
			<div class="section-header">
				<h4 class="section-title">Connections</h4>
				<a href="/connections/new?source={cardId}" class="section-action">Add</a>
			</div>
			{#if ($cardConnections?.asSource ?? []).length === 0 && ($cardConnections?.asTarget ?? []).length === 0}
				<p class="section-empty">No connections</p>
			{:else}
				<div class="connection-list">
					{#each $cardConnections?.asSource ?? [] as conn}
						<a href="/connections/{conn.connectionId}" class="connection-item">
							<span class="conn-type">{conn.type}</span>
							<span class="conn-arrow">→</span>
							<span class="conn-card">{getEndpointName(conn.targetCardId)}</span>
						</a>
					{/each}
					{#each $cardConnections?.asTarget ?? [] as conn}
						<a href="/connections/{conn.connectionId}" class="connection-item">
							<span class="conn-card">{getEndpointName(conn.sourceCardId)}</span>
							<span class="conn-arrow">→</span>
							<span class="conn-type">{conn.type}</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<!-- Collection manager bottom sheet -->
	<BottomSheet bind:open={showCollections} title="Manage Collections">
		{#if ($collections ?? []).length === 0}
			<p class="section-empty">No collections yet. <a href="/collections/new">Create one</a></p>
		{:else}
			<div class="collection-checks">
				{#each $collections ?? [] as col}
					{@const isMember = ($cardCollections ?? []).some((cc) => cc.collectionId === col.collectionId)}
					<label class="check-item">
						<input
							type="checkbox"
							checked={isMember}
							onchange={() => toggleCollection(col.collectionId, isMember)}
						/>
						<span>{col.name}</span>
					</label>
				{/each}
			</div>
		{/if}
	</BottomSheet>

	<!-- Delete confirmation -->
	{#if confirmDelete}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="confirm-overlay" onclick={() => (confirmDelete = false)} onkeydown={() => {}}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="confirm-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
				<p class="confirm-text">Delete this card? This will also remove it from all collections and delete its connections.</p>
				<div class="confirm-actions">
					<button class="action-btn" onclick={() => (confirmDelete = false)}>Cancel</button>
					<button class="action-btn danger" onclick={deleteCard}>Delete</button>
				</div>
			</div>
		</div>
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

	.section-action {
		font-size: 0.8125rem;
		color: var(--color-primary);
		font-weight: 500;
		text-decoration: none;
	}

	.section-empty {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
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

	.connection-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.connection-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		text-decoration: none;
		color: var(--color-text);
		transition: background 0.15s;
	}

	.connection-item:hover {
		background: var(--color-bg);
	}

	.conn-type {
		font-weight: 600;
		color: var(--color-primary);
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.conn-arrow {
		color: var(--color-text-secondary);
	}

	.conn-card {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		accent-color: var(--color-primary);
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
