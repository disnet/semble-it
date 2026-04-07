<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { db } from '$lib/db';
	import { CONNECTION_TYPES, type ConnectionType } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import CardPicker from '$lib/components/cards/CardPicker.svelte';

	let sourceCardId = $state<string | undefined>($page.url.searchParams.get('source') ?? undefined);
	let targetCardId = $state<string | undefined>(undefined);
	let connectionType = $state<ConnectionType | undefined>(undefined);
	let note = $state('');
	let saving = $state(false);

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
		if (!sourceCardId || !targetCardId || !connectionType) return;
		saving = true;
		try {
			const connectionId = crypto.randomUUID();
			const now = new Date();
			await db.connections.add({
				connectionId,
				sourceCardId,
				targetCardId,
				type: connectionType,
				note: note.trim() || undefined,
				createdAt: now,
				updatedAt: now
			});
			goto(`/connections/${connectionId}`);
		} finally {
			saving = false;
		}
	}

	let canSave = $derived(!!sourceCardId && !!targetCardId && !!connectionType && sourceCardId !== targetCardId);
</script>

<PageHeader title="New Connection" />

<div class="form-container">
	<CardPicker bind:selected={sourceCardId} label="Source card *" />

	<div class="type-section">
		<span class="field-label">Connection type *</span>
		<div class="type-grid">
			{#each CONNECTION_TYPES as t}
				<button
					class="type-chip"
					class:selected={connectionType === t}
					onclick={() => (connectionType = t)}
					title={typeDescriptions[t]}
				>
					{t.replace('_', ' ')}
				</button>
			{/each}
		</div>
	</div>

	<CardPicker bind:selected={targetCardId} excludeId={sourceCardId} label="Target card *" />

	<label class="field">
		<span class="field-label">Note</span>
		<textarea bind:value={note} placeholder="Why are these connected?" class="field-textarea" rows="3"></textarea>
	</label>

	<button class="save-btn" onclick={save} disabled={saving || !canSave}>
		{saving ? 'Creating…' : 'Create Connection'}
	</button>
</div>

<style>
	.form-container {
		padding: var(--space-md);
		max-width: 600px;
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
		letter-spacing: 0.02em;
		border: 1px solid var(--color-border);
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}

	.type-chip.selected {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.type-chip:hover:not(.selected) {
		background: var(--color-primary-light);
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
