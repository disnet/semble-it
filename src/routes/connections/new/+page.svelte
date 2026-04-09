<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { createConnectionInPDS } from '$lib/pds';
	import { CONNECTION_TYPES, type ConnectionType } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardPicker from '$lib/components/cards/CardPicker.svelte';
	import CardTypeBadge from '$lib/components/cards/CardTypeBadge.svelte';

	const sourcePreset = !!$page.url.searchParams.get('source');
	let sourceCardId = $state<string | undefined>($page.url.searchParams.get('source') ?? undefined);

	const sourceCard = liveQuery(() =>
		sourcePreset && sourceCardId ? db.cards.where('cardId').equals(sourceCardId).first() : undefined
	);

	function getCardLabel(card: import('$lib/types').Card): string {
		if (card.type === 'URL') return card.title || card.url;
		return card.text.slice(0, 80);
	}
	let targetCardId = $state<string | undefined>(undefined);
	let connectionType = $state<ConnectionType | undefined>(undefined);
	let note = $state('');
	let saving = $state(false);

	interface PendingConnection {
		targetCardId: string;
		type: ConnectionType;
		note?: string;
	}
	let pending = $state<PendingConnection[]>([]);

	const pendingCards = liveQuery(() => {
		const ids = pending.map((p) => p.targetCardId);
		if (ids.length === 0) return Promise.resolve([]);
		return db.cards.where('cardId').anyOf(ids).toArray();
	});

	$effect(() => {
		if (!targetCardId || !connectionType || !sourceCardId || targetCardId === sourceCardId) return;
		if (pending.some((p) => p.targetCardId === targetCardId && p.type === connectionType)) return;
		pending.push({ targetCardId, type: connectionType, note: note.trim() || undefined });
		targetCardId = undefined;
		note = '';
	});

	function removePending(index: number) {
		pending.splice(index, 1);
	}

	function getPendingCardLabel(cardId: string): string {
		const card = ($pendingCards ?? []).find((c) => c.cardId === cardId);
		if (!card) return cardId;
		return getCardLabel(card);
	}

	const typeDescriptions: Record<ConnectionType, string> = {
		SUPPORTS: 'Backs up or reinforces',
		OPPOSES: 'Contradicts or challenges',
		ADDRESSES: 'Responds to or tackles',
		HELPFUL: 'Useful context',
		LEADS_TO: 'Leads to or causes',
		RELATED: 'Generally related',
		SUPPLEMENT: 'Additional material',
		EXPLAINER: 'Explains or clarifies'
	};

	async function save() {
		if (!sourceCardId || pending.length === 0) return;
		saving = true;
		try {
			for (const p of pending) {
				const connectionId = crypto.randomUUID();
				const now = new Date();
				const connection: import('$lib/types').Connection = {
					connectionId,
					sourceCardId,
					targetCardId: p.targetCardId,
					type: p.type,
					note: p.note,
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
			}
			goto(`/cards/${sourceCardId}`);
		} finally {
			saving = false;
		}
	}

	let canSave = $derived(!!sourceCardId && pending.length > 0);
</script>

<PageHeader title="New Connection" />

<div class="form-container">
	{#if sourcePreset && $sourceCard}
		<div class="source-display">
			<span class="field-label">Source card</span>
			<div class="source-card">
				<CardTypeBadge type={$sourceCard.type} />
				<span class="source-card-label">{getCardLabel($sourceCard)}</span>
			</div>
		</div>
	{:else}
		<CardPicker bind:selected={sourceCardId} label="Source card *" />
	{/if}

	<label class="field">
		<span class="field-label">Connection type *</span>
		<select class="field-select" bind:value={connectionType}>
			<option value={undefined}>Select type…</option>
			{#each CONNECTION_TYPES as t}
				<option value={t}>{t.replace('_', ' ')} — {typeDescriptions[t]}</option>
			{/each}
		</select>
	</label>

	<CardPicker bind:selected={targetCardId} excludeId={sourceCardId} label="Target card *" />

	<label class="field">
		<span class="field-label">Note</span>
		<textarea bind:value={note} placeholder="Why are these connected?" class="field-textarea" rows="3"></textarea>
	</label>

	{#if pending.length > 0}
		<div class="pending-section">
			<span class="field-label">Pending connections ({pending.length})</span>
			<div class="pending-list">
				{#each pending as p, i (i)}
					<div class="pending-item">
						<span class="pending-type">{p.type.replace('_', ' ')}</span>
						<span class="pending-target">{getPendingCardLabel(p.targetCardId)}</span>
						{#if p.note}<span class="pending-note">{p.note}</span>{/if}
						<button class="pending-remove" onclick={() => removePending(i)} title="Remove">&times;</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<button class="save-btn" onclick={save} disabled={saving || !canSave}>
		{saving ? 'Creating…' : `Create ${pending.length} Connection${pending.length !== 1 ? 's' : ''}`}
	</button>
</div>

<style>
	.form-container {
		padding: var(--space-md);
		max-width: 600px;
	}

	.source-display {
		margin-bottom: var(--space-md);
	}

	.source-card {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-primary-light);
		font-size: 0.8125rem;
	}

	.source-card-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.field-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-xs);
	}

	.field-select {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.875rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.field-select:focus {
		border-color: var(--color-primary);
	}

	.field {
		display: block;
		margin-bottom: var(--space-md);
	}

	.field-textarea {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.9375rem;
		outline: none;
		resize: vertical;
		min-height: 80px;
		transition: border-color 0.15s;
	}

	.field-textarea:focus {
		border-color: var(--color-primary);
	}

	.pending-section {
		margin-bottom: var(--space-md);
	}

	.pending-list {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.pending-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		font-size: 0.8125rem;
		border-bottom: 1px solid var(--color-border);
	}

	.pending-item:last-child {
		border-bottom: none;
	}

	.pending-type {
		flex-shrink: 0;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		color: white;
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.pending-target {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pending-note {
		flex-shrink: 0;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pending-remove {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		font-size: 1rem;
		color: var(--color-text-secondary);
		transition: background 0.15s, color 0.15s;
	}

	.pending-remove:hover {
		background: var(--color-border);
		color: var(--color-text);
	}

	.save-btn {
		width: 100%;
		padding: var(--space-md);
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		transition: background 0.15s;
	}

	.save-btn:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
