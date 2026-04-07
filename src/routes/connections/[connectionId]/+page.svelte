<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { updateConnectionInPDS, deleteConnectionFromPDS } from '$lib/pds';
	import { CONNECTION_TYPES, type ConnectionType } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';

	const connectionId = $derived($page.params.connectionId!);

	const connection = liveQuery(() => db.connections.get(connectionId));
	const allCards = liveQuery(() => db.cards.toArray());

	let editing = $state(false);
	let editType = $state<ConnectionType>('RELATED');
	let editNote = $state('');
	let confirmDelete = $state(false);

	function getCardName(cardId: string): string {
		const cards = $allCards ?? [];
		const c = cards.find((c) => c.cardId === cardId);
		if (!c) return cardId.slice(0, 8) + '…';
		if (c.type === 'URL') return c.title || c.url;
		return c.text.slice(0, 80);
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
				<a href="/cards/{$connection.sourceCardId}" class="conn-card-link">
					{getCardName($connection.sourceCardId)}
				</a>
				<div class="conn-type-display">{$connection.type.replace('_', ' ')}</div>
				<a href="/cards/{$connection.targetCardId}" class="conn-card-link">
					{getCardName($connection.targetCardId)}
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
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="confirm-overlay" onclick={() => (confirmDelete = false)} onkeydown={() => {}}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="confirm-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
				<p class="confirm-text">Delete this connection?</p>
				<div class="confirm-actions">
					<button class="action-btn" onclick={() => (confirmDelete = false)}>Cancel</button>
					<button class="action-btn danger" onclick={deleteConnection}>Delete</button>
				</div>
			</div>
		</div>
	{/if}
{:else}
	<div class="detail-container">
		<p>Connection not found.</p>
	</div>
{/if}

<style>
	.detail-container {
		padding: var(--space-md);
		max-width: 600px;
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
