<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { db } from '$lib/db';
	import type { CardType } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';

	let cardType: CardType = $state(($page.url.searchParams.get('type') as CardType) || 'URL');

	// URL card fields
	let url = $state($page.url.searchParams.get('url') || '');
	let title = $state($page.url.searchParams.get('title') || '');
	let description = $state('');

	// Note card fields
	let noteText = $state('');

	// Highlight card fields
	let highlightText = $state('');
	let sourceUrl = $state('');
	let sourceTitle = $state('');
	let context = $state('');

	let saving = $state(false);

	async function save() {
		saving = true;
		try {
			const now = new Date();
			const cardId = crypto.randomUUID();
			const base = { cardId, createdAt: now, updatedAt: now };

			if (cardType === 'URL') {
				if (!url.trim()) return;
				await db.cards.add({ ...base, type: 'URL', url: url.trim(), title: title.trim() || undefined, description: description.trim() || undefined });
			} else if (cardType === 'NOTE') {
				if (!noteText.trim()) return;
				await db.cards.add({ ...base, type: 'NOTE', text: noteText.trim() });
			} else if (cardType === 'HIGHLIGHT') {
				if (!highlightText.trim() || !sourceUrl.trim()) return;
				await db.cards.add({
					...base,
					type: 'HIGHLIGHT',
					text: highlightText.trim(),
					sourceUrl: sourceUrl.trim(),
					sourceTitle: sourceTitle.trim() || undefined,
					context: context.trim() || undefined
				});
			}

			goto(`/cards/${cardId}`);
		} finally {
			saving = false;
		}
	}
</script>

<PageHeader title="New Card" />

<div class="form-container">
	<div class="type-selector">
		<button class="type-btn" class:active={cardType === 'URL'} onclick={() => (cardType = 'URL')}>
			URL
		</button>
		<button class="type-btn" class:active={cardType === 'NOTE'} onclick={() => (cardType = 'NOTE')}>
			Note
		</button>
		<button
			class="type-btn"
			class:active={cardType === 'HIGHLIGHT'}
			onclick={() => (cardType = 'HIGHLIGHT')}
		>
			Highlight
		</button>
	</div>

	{#if cardType === 'URL'}
		<label class="field">
			<span class="field-label">URL *</span>
			<input type="url" bind:value={url} placeholder="https://example.com" class="field-input" />
		</label>
		<label class="field">
			<span class="field-label">Title</span>
			<input type="text" bind:value={title} placeholder="Page title" class="field-input" />
		</label>
		<label class="field">
			<span class="field-label">Description</span>
			<textarea bind:value={description} placeholder="Brief description" class="field-textarea" rows="3"></textarea>
		</label>
	{:else if cardType === 'NOTE'}
		<label class="field">
			<span class="field-label">Note *</span>
			<textarea bind:value={noteText} placeholder="Write your note…" class="field-textarea" rows="6"></textarea>
		</label>
	{:else if cardType === 'HIGHLIGHT'}
		<label class="field">
			<span class="field-label">Highlighted text *</span>
			<textarea bind:value={highlightText} placeholder="The highlighted text" class="field-textarea" rows="4"></textarea>
		</label>
		<label class="field">
			<span class="field-label">Source URL *</span>
			<input type="url" bind:value={sourceUrl} placeholder="https://example.com/article" class="field-input" />
		</label>
		<label class="field">
			<span class="field-label">Source title</span>
			<input type="text" bind:value={sourceTitle} placeholder="Article title" class="field-input" />
		</label>
		<label class="field">
			<span class="field-label">Context</span>
			<textarea bind:value={context} placeholder="Surrounding text for context" class="field-textarea" rows="3"></textarea>
		</label>
	{/if}

	<button class="save-btn" onclick={save} disabled={saving}>
		{saving ? 'Saving…' : 'Save Card'}
	</button>
</div>

<style>
	.form-container {
		padding: var(--space-md);
		max-width: 600px;
	}

	.type-selector {
		display: flex;
		gap: var(--space-xs);
		margin-bottom: var(--space-lg);
		background: var(--color-bg);
		border-radius: var(--radius-md);
		padding: 4px;
	}

	.type-btn {
		flex: 1;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.type-btn.active {
		background: var(--color-surface);
		color: var(--color-primary);
		box-shadow: var(--shadow-sm);
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
		margin-top: var(--space-sm);
	}

	.save-btn:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
