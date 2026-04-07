<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';

	let name = $state('');
	let description = $state('');
	let saving = $state(false);

	async function save() {
		if (!name.trim()) return;
		saving = true;
		try {
			const collectionId = crypto.randomUUID();
			const now = new Date();
			await db.collections.add({
				collectionId,
				name: name.trim(),
				description: description.trim() || undefined,
				createdAt: now,
				updatedAt: now
			});
			goto(`/collections/${collectionId}`);
		} finally {
			saving = false;
		}
	}
</script>

<PageHeader title="New Collection" />

<div class="form-container">
	<label class="field">
		<span class="field-label">Name *</span>
		<input type="text" bind:value={name} placeholder="Collection name" class="field-input" />
	</label>
	<label class="field">
		<span class="field-label">Description</span>
		<textarea bind:value={description} placeholder="What's this collection about?" class="field-textarea" rows="3"></textarea>
	</label>
	<button class="save-btn" onclick={save} disabled={saving || !name.trim()}>
		{saving ? 'Creating…' : 'Create Collection'}
	</button>
</div>

<style>
	.form-container {
		padding: var(--space-md);
		max-width: 600px;
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
		min-height: 80px;
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
