<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { updateCardInPDS, deleteCardFromPDS, createCollectionLinkInPDS, deleteCollectionLinkFromPDS, deleteConnectionFromPDS, createConnectionInPDS } from '$lib/pds';
	import type { Card } from '$lib/types';
	import { CONNECTION_TYPES, type ConnectionType } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardTypeBadge from '$lib/components/cards/CardTypeBadge.svelte';
	import CardPicker from '$lib/components/cards/CardPicker.svelte';
	import CollectionPicker from '$lib/components/collections/CollectionPicker.svelte';

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

	let editing = $state(false);
	let addToCollection = $state<string | undefined>(undefined);
	let confirmDelete = $state(false);

	// Inline connection form
	let newConnType = $state<ConnectionType>('RELATED');
	let newConnTarget = $state<string | undefined>(undefined);
	let creatingConn = $state(false);
	let confirmDeleteConn = $state<string | null>(null);

	async function deleteConnection(connId: string) {
		const conn = await db.connections.get(connId);
		if (auth.session && conn) await deleteConnectionFromPDS(auth.session, conn);
		await db.connections.delete(connId);
		confirmDeleteConn = null;
	}

	// Collections this card already belongs to
	let memberCollectionIds = $derived(
		($cardCollections ?? []).map((cc) => cc.collectionId)
	);

	$effect(() => {
		if (!addToCollection) return;
		const colId = addToCollection;
		addToCollection = undefined;
		toggleCollection(colId, false);
	});

	// Cards already connected with the selected type (as source)
	let connectedWithType = $derived.by(() => {
		const conns = $cardConnections?.asSource ?? [];
		return conns.filter((c) => c.type === newConnType).map((c) => c.targetCardId);
	});

	$effect(() => {
		if (!newConnTarget || !newConnType || newConnTarget === cardId) return;
		const targetId = newConnTarget;
		const type = newConnType;
		// Reset immediately so the picker clears
		newConnTarget = undefined;
		// Create the connection
		createConnection(targetId, type);
	});

	async function createConnection(targetId: string, type: ConnectionType) {
		creatingConn = true;
		try {
			const connectionId = crypto.randomUUID();
			const now = new Date();
			const connection: import('$lib/types').Connection = {
				connectionId,
				sourceCardId: cardId,
				targetCardId: targetId,
				type,
				createdAt: now,
				updatedAt: now
			};
			if (auth.session) {
				const ref = await createConnectionInPDS(auth.session, connection);
				connection.uri = ref.uri;
				connection.cid = ref.cid;
				connection.connectionId = ref.uri.split('/').pop()!;
			}
			await db.connections.add(connection);
		} finally {
			creatingConn = false;
		}
	}

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

		<!-- Connections section -->
		<section class="section">
			<div class="section-header">
				<h4 class="section-title">Connections</h4>
			</div>
			<div class="inline-conn-form">
				<select class="conn-type-select" bind:value={newConnType}>
					{#each CONNECTION_TYPES as t}
						<option value={t}>{t.replace('_', ' ')}</option>
					{/each}
				</select>
				<div class="conn-picker-wrap">
					<CardPicker bind:selected={newConnTarget} excludeId={cardId} excludeIds={connectedWithType} label="" />
				</div>
			</div>
			{#if ($cardConnections?.asSource ?? []).length === 0 && ($cardConnections?.asTarget ?? []).length === 0}
				<p class="section-empty">No connections yet</p>
			{:else}
				<div class="connection-list">
					{#each $cardConnections?.asSource ?? [] as conn}
						<div class="connection-chip">
							<a href="/connections/{conn.connectionId}" class="connection-chip-link">
								<span class="conn-type-badge">{conn.type.replace('_', ' ')}</span>
								<span class="conn-card-name">{getEndpointName(conn.targetCardId)}</span>
							</a>
							{#if confirmDeleteConn === conn.connectionId}
								<span class="conn-confirm">
									<button class="conn-confirm-btn danger" onclick={() => deleteConnection(conn.connectionId)}>Delete</button>
									<button class="conn-confirm-btn" onclick={() => (confirmDeleteConn = null)}>Cancel</button>
								</span>
							{:else}
								<button class="conn-chip-delete" onclick={() => (confirmDeleteConn = conn.connectionId)} title="Delete connection">&times;</button>
							{/if}
						</div>
					{/each}
					{#each $cardConnections?.asTarget ?? [] as conn}
						<div class="connection-chip">
							<a href="/connections/{conn.connectionId}" class="connection-chip-link">
								<span class="conn-type-badge">{conn.type.replace('_', ' ')}</span>
								<span class="conn-card-name">{getEndpointName(conn.sourceCardId)}</span>
							</a>
							{#if confirmDeleteConn === conn.connectionId}
								<span class="conn-confirm">
									<button class="conn-confirm-btn danger" onclick={() => deleteConnection(conn.connectionId)}>Delete</button>
									<button class="conn-confirm-btn" onclick={() => (confirmDeleteConn = null)}>Cancel</button>
								</span>
							{:else}
								<button class="conn-chip-delete" onclick={() => (confirmDeleteConn = conn.connectionId)} title="Delete connection">&times;</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>

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

	.inline-conn-form {
		display: flex;
		gap: var(--space-sm);
		align-items: flex-start;
		margin-bottom: var(--space-md);
	}

	.conn-type-select {
		flex-shrink: 0;
		padding: var(--space-sm) var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.75rem;
		outline: none;
		transition: border-color 0.15s;
		max-width: 110px;
	}

	.conn-type-select:focus {
		border-color: var(--color-primary);
	}

	.conn-picker-wrap {
		flex: 1;
		min-width: 0;
	}

	.conn-picker-wrap :global(.picker) {
		margin-bottom: 0;
	}

	.conn-picker-wrap :global(.picker-label) {
		display: none;
	}

	.connection-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.connection-chip {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color 0.15s;
	}

	.connection-chip:hover {
		border-color: var(--color-primary);
	}

	.connection-chip-link {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		text-decoration: none;
		color: var(--color-text);
		font-size: 0.8125rem;
		min-width: 0;
	}

	.conn-type-badge {
		font-weight: 600;
		color: var(--color-primary);
		font-size: 0.6875rem;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.conn-card-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}

	.conn-chip-delete {
		flex-shrink: 0;
		width: 28px;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		border-left: 1px solid var(--color-border);
		transition: background 0.15s, color 0.15s;
	}

	.conn-chip-delete:hover {
		background: var(--color-danger-light);
		color: var(--color-danger);
	}

	.conn-confirm {
		display: flex;
		gap: var(--space-xs);
		flex-shrink: 0;
		padding: 0 var(--space-xs);
	}

	.conn-confirm-btn {
		padding: 2px 8px;
		border-radius: var(--radius-md);
		font-size: 0.6875rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
	}

	.conn-confirm-btn.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}

	.conn-confirm-btn.danger:hover {
		background: var(--color-danger-light);
	}

	.collection-picker-wrap {
		margin-bottom: var(--space-sm);
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
