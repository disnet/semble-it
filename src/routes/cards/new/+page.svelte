<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { createCardInPDS } from '$lib/pds';
	import type { Card } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';

	let url = $state($page.url.searchParams.get('url') || '');
	let title = $state($page.url.searchParams.get('title') || '');
	let description = $state('');
	let noteText = $state('');

	let saving = $state(false);

	async function save() {
		if (!url.trim()) return;
		saving = true;
		try {
			const now = new Date();

			// Create URL card
			const urlCard: Card = {
				cardId: crypto.randomUUID(),
				type: 'URL',
				url: url.trim(),
				title: title.trim() || undefined,
				description: description.trim() || undefined,
				createdAt: now,
				updatedAt: now
			};

			if (auth.session) {
				const ref = await createCardInPDS(auth.session, urlCard);
				urlCard.uri = ref.uri;
				urlCard.cid = ref.cid;
				urlCard.cardId = ref.uri.split('/').pop()!;
			}
			await db.cards.add(urlCard);

			// Optionally create a note card as child
			if (noteText.trim()) {
				const noteCard: Card = {
					cardId: crypto.randomUUID(),
					type: 'NOTE',
					text: noteText.trim(),
					parentCardId: urlCard.cardId,
					createdAt: now,
					updatedAt: now
				};

				if (auth.session && urlCard.uri && urlCard.cid) {
					const ref = await createCardInPDS(auth.session, noteCard, {
						uri: urlCard.uri,
						cid: urlCard.cid
					});
					noteCard.uri = ref.uri;
					noteCard.cid = ref.cid;
					noteCard.cardId = ref.uri.split('/').pop()!;
				}
				await db.cards.add(noteCard);
			}

			goto(`/cards/${urlCard.cardId}`);
		} finally {
			saving = false;
		}
	}
</script>

<PageHeader title="New Card" />

<div class="form-container">
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

	<label class="field">
		<span class="field-label">Note</span>
		<textarea bind:value={noteText} placeholder="Add a note about this link…" class="field-textarea" rows="4"></textarea>
	</label>

	<button class="save-btn" onclick={save} disabled={saving || !url.trim()}>
		{saving ? 'Saving…' : 'Save Card'}
	</button>
</div>

<style>
	.form-container {
		padding: var(--space-md);
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
