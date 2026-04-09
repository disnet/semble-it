<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { updateConnectionInPDS, deleteConnectionFromPDS } from '$lib/pds';
	import { CONNECTION_TYPES, type ConnectionType } from '$lib/types';
	import { isUrl } from '$lib/utils';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte';

	const connectionId = $derived($page.params.connectionId!);

	const connection = liveQuery(() => db.connections.get(connectionId));
	const allCards = liveQuery(() => db.cards.toArray());

	let editing = $state(false);
	let editType = $state<ConnectionType>('RELATED');
	let editNote = $state('');
	let confirmDelete = $state(false);

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
		return c.text.slice(0, 80);
	}

	function endpointHref(value: string): string {
		return isUrl(value) ? value : '/cards';
	}

	function startEdit() {
		if (!$connection) return;
		editType = $connection.type;
		editNote = $connection.note ?? '';
		editing = true;
	}

	async function saveEdit() {
		if (!$connection) return;
		const updated = {
			...$connection,
			type: editType,
			note: editNote.trim() || undefined,
			updatedAt: new Date()
		};
		if (auth.session) await updateConnectionInPDS(auth.session, updated);
		await db.connections.put(updated);
		editing = false;
	}

	async function deleteConnection() {
		if (auth.session && $connection) await deleteConnectionFromPDS(auth.session, $connection);
		await db.connections.delete(connectionId);
		goto('/connections');
	}
</script>

<PageHeader title="Connection" />

{#if $connection}
	<div class="detail-container">
		{#if !editing}
			<div class="conn-visual">
				<a
					href={endpointHref($connection.sourceCardId)}
					class="conn-card-link"
					{...(isUrl($connection.sourceCardId) ? { target: '_blank', rel: 'noopener' } : {})}
				>
					{getEndpointName($connection.sourceCardId)}
				</a>
				<div class="conn-type-display">{$connection.type.replace('_', ' ')}</div>
				<a
					href={endpointHref($connection.targetCardId)}
					class="conn-card-link"
					{...(isUrl($connection.targetCardId) ? { target: '_blank', rel: 'noopener' } : {})}
				>
					{getEndpointName($connection.targetCardId)}
				</a>
			</div>

			{#if $connection.note}
				<p class="conn-note">{$connection.note}</p>
			{/if}

			<div class="actions">
				<button class="action-btn" onclick={startEdit}>Edit</button>
				<button class="action-btn danger" onclick={() => (confirmDelete = true)}>Delete</button>
			</div>
		{:else}
			<div class="edit-form">
				<div class="type-section">
					<span class="field-label">Connection type</span>
					<div class="type-grid">
						{#each CONNECTION_TYPES as t}
							<button
								class="type-chip"
								class:selected={editType === t}
								onclick={() => (editType = t)}
							>
								{t.replace('_', ' ')}
							</button>
						{/each}
					</div>
				</div>

				<label class="field">
					<span class="field-label">Note</span>
					<textarea bind:value={editNote} class="field-textarea" rows="3"></textarea>
				</label>

				<div class="edit-actions">
					<button class="action-btn" onclick={saveEdit}>Save</button>
					<button class="action-btn" onclick={() => (editing = false)}>Cancel</button>
				</div>
			</div>
		{/if}
	</div>

	{#if confirmDelete}
		<ConfirmDialog
			message="Delete this connection?"
			onconfirm={deleteConnection}
			oncancel={() => (confirmDelete = false)}
		/>
	{/if}
{:else}
	<div class="detail-container">
		<p>Connection not found.</p>
	</div>
{/if}

<style>
	.detail-container {
		padding: var(--space-md);
	}

	.conn-visual {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-lg);
		background: var(--color-bg);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-md);
	}

	.conn-card-link {
		text-align: center;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-primary);
		text-decoration: none;
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.conn-type-display {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-primary);
		padding: 4px 12px;
		background: var(--color-primary-light);
		border-radius: var(--radius-full);
	}

	.conn-note {
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
		margin-bottom: var(--space-md);
	}

	.actions,
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

	.type-section {
		margin-bottom: var(--space-md);
	}

	.field-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-xs);
	}

	.type-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.type-chip {
		padding: 6px 12px;
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		border: 1px solid var(--color-border);
		transition:
			background 0.15s,
			color 0.15s;
	}

	.type-chip.selected {
		background: var(--color-primary);
		color: white;
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
		transition: border-color 0.15s;
	}

	.field-textarea:focus {
		border-color: var(--color-primary);
	}

</style>
