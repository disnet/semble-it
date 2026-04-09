<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { createCollectionLinkInPDS, deleteCollectionLinkFromPDS } from '$lib/pds';
	import type { Card } from '$lib/types';
	import { Plus, Check } from 'lucide-svelte';
	import CardTypeBadge from './CardTypeBadge.svelte';

	let { value }: { value: Record<string, unknown> } = $props();

	const cardType = $derived((value.type as string) ?? 'NOTE');

	// Collections dropdown state
	let dropdownOpen = $state(false);
	let containerEl: HTMLDivElement | undefined = $state(undefined);

	const allCollections = liveQuery(() => db.collections.orderBy('name').toArray());

	// Track which collections this card is in (by matching on imported cardId)
	let importedCardId = $state<string | undefined>(undefined);

	// Try to find existing local card matching this remote card
	$effect(() => {
		const content = value.content as Record<string, unknown> | undefined;
		const type = (value.type as string) ?? 'NOTE';
		if (type === 'URL') {
			const url = (content?.url as string) || (value.url as string) || '';
			if (url) {
				db.cards.where('url').equals(url).first().then((card) => {
					if (card) importedCardId = card.cardId;
				});
			}
		}
	});

	let cardCollectionLinksData = $state<import('$lib/types').CollectionCard[]>([]);

	$effect(() => {
		const id = importedCardId;
		if (!id) {
			cardCollectionLinksData = [];
			return;
		}
		const observable = liveQuery(() => db.collectionCards.where('cardId').equals(id).toArray());
		const subscription = observable.subscribe({
			next: (val) => { cardCollectionLinksData = val; },
			error: () => { cardCollectionLinksData = []; }
		});
		return () => subscription.unsubscribe();
	});

	let memberCollectionIds = $derived(
		new Set(cardCollectionLinksData.map((cc) => cc.collectionId))
	);

	function handleClickOutside(e: MouseEvent) {
		if (containerEl && !containerEl.contains(e.target as Node)) {
			dropdownOpen = false;
		}
	}

	$effect(() => {
		if (dropdownOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	});

	async function getOrCreateLocalCard(): Promise<Card> {
		if (importedCardId) {
			const existing = await db.cards.get(importedCardId);
			if (existing) return existing;
		}

		const content = value.content as Record<string, unknown> | undefined;
		const type = (value.type as string) ?? 'NOTE';
		const now = new Date();
		const cardId = crypto.randomUUID();

		let card: Card;
		if (type === 'URL') {
			const metadata = content?.metadata as Record<string, unknown> | undefined;
			card = {
				cardId,
				type: 'URL',
				url: (content?.url as string) || (value.url as string) || '',
				title: (metadata?.title as string) || undefined,
				description: (metadata?.description as string) || undefined,
				imageUrl: (metadata?.imageUrl as string) || undefined,
				createdAt: now,
				updatedAt: now
			};
		} else {
			card = {
				cardId,
				type: 'NOTE',
				text: (content?.text as string) || '',
				createdAt: now,
				updatedAt: now
			};
		}

		await db.cards.add(card);
		importedCardId = card.cardId;
		return card;
	}

	async function toggleCollection(collectionId: string) {
		const isMember = memberCollectionIds.has(collectionId);

		if (isMember && importedCardId) {
			const ccLink = cardCollectionLinksData.find((cc) => cc.collectionId === collectionId);
			if (auth.session && ccLink) {
				try { await deleteCollectionLinkFromPDS(auth.session, ccLink); } catch {}
			}
			await db.collectionCards.where('[collectionId+cardId]').equals([collectionId, importedCardId]).delete();
		} else {
			const card = await getOrCreateLocalCard();
			const col = ($allCollections ?? []).find((c) => c.collectionId === collectionId);
			const cc = { collectionId, cardId: card.cardId, addedAt: new Date() } as import('$lib/types').CollectionCard;
			if (auth.session && card && col) {
				try {
					const ref = await createCollectionLinkInPDS(auth.session, card, col);
					cc.uri = ref.uri;
					cc.cid = ref.cid;
				} catch {}
			}
			await db.collectionCards.add(cc);
		}
	}

	const title = $derived.by(() => {
		if (cardType === 'URL') {
			const content = value.content as Record<string, unknown> | undefined;
			const metadata = content?.metadata as Record<string, unknown> | undefined;
			return (metadata?.title as string) || (content?.url as string) || (value.url as string) || '';
		}
		const content = value.content as Record<string, unknown> | undefined;
		return ((content?.text as string) || '').slice(0, 100);
	});

	const subtitle = $derived.by(() => {
		if (cardType === 'URL') {
			const content = value.content as Record<string, unknown> | undefined;
			const metadata = content?.metadata as Record<string, unknown> | undefined;
			return (metadata?.description as string) || (content?.url as string) || (value.url as string) || '';
		}
		const content = value.content as Record<string, unknown> | undefined;
		const text = (content?.text as string) || '';
		return text.length > 100 ? text.slice(100, 200) + '\u2026' : '';
	});

	const imageUrl = $derived.by(() => {
		if (cardType !== 'URL') return undefined;
		const content = value.content as Record<string, unknown> | undefined;
		const metadata = content?.metadata as Record<string, unknown> | undefined;
		return (metadata?.imageUrl as string) || undefined;
	});

	const externalUrl = $derived.by(() => {
		if (cardType !== 'URL') return undefined;
		const content = value.content as Record<string, unknown> | undefined;
		return (content?.url as string) || (value.url as string) || undefined;
	});

	const domain = $derived.by(() => {
		if (!externalUrl) return '';
		try {
			return new URL(externalUrl).hostname.replace(/^www\./, '');
		} catch {
			return externalUrl;
		}
	});
</script>

<div class="card-wrapper" bind:this={containerEl}>
	{#if externalUrl}
		<a href={externalUrl} target="_blank" rel="noopener noreferrer" class="card-item" class:has-image={!!imageUrl}>
			{#if imageUrl}
				<img src={imageUrl} alt="" class="card-image" />
			{/if}
			<div class="card-item-body">
				<div class="card-item-header">
					<CardTypeBadge type={cardType === 'URL' ? 'URL' : 'NOTE'} />
					{#if cardType === 'URL' && domain}
						<span class="url-domain">
							{domain}
							<svg class="url-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7" /><path d="M13 3L3 13" /></svg>
						</span>
					{/if}
				</div>
				<div class="card-title">{title}</div>
				{#if subtitle}
					<div class="card-subtitle">{subtitle}</div>
				{/if}
			</div>
		</a>
	{:else}
		<div class="card-item">
			<div class="card-item-body">
				<div class="card-item-header">
					<CardTypeBadge type="NOTE" />
				</div>
				<div class="card-title">{title}</div>
				{#if subtitle}
					<div class="card-subtitle">{subtitle}</div>
				{/if}
			</div>
		</div>
	{/if}

	<button
		class="add-to-collection-btn"
		class:has-selections={memberCollectionIds.size > 0}
		onclick={(e) => { e.preventDefault(); e.stopPropagation(); dropdownOpen = !dropdownOpen; }}
		title="Add to collection"
	>
		{#if memberCollectionIds.size > 0}
			<Check size={14} />
		{:else}
			<Plus size={14} />
		{/if}
	</button>

	{#if dropdownOpen}
		<div class="collection-dropdown">
			{#if ($allCollections ?? []).length === 0}
				<p class="dropdown-empty">No collections yet</p>
			{:else}
				{#each $allCollections ?? [] as col (col.collectionId)}
					{@const isMember = memberCollectionIds.has(col.collectionId)}
					<button
						class="dropdown-item"
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCollection(col.collectionId); }}
					>
						<span class="dropdown-check" class:checked={isMember}>
							{#if isMember}
								<Check size={12} />
							{/if}
						</span>
						<span class="dropdown-label">{col.name}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.card-wrapper {
		position: relative;
	}

	.card-item {
		display: block;
		padding: var(--space-md);
		padding-right: calc(var(--space-md) + 28px);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		box-shadow: var(--shadow-sm);
		transition: box-shadow 0.15s;
	}

	.card-item.has-image {
		display: flex;
		align-items: stretch;
		gap: var(--space-md);
	}

	a.card-item:hover {
		box-shadow: var(--shadow-md);
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

	.url-domain {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.url-arrow {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
	}

	.card-title {
		font-weight: 500;
		font-size: 0.9375rem;
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-subtitle {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.add-to-collection-btn {
		position: absolute;
		top: var(--space-sm);
		right: var(--space-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-full);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
		z-index: 2;
	}

	.add-to-collection-btn:hover {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.add-to-collection-btn.has-selections {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.collection-dropdown {
		position: absolute;
		top: calc(var(--space-sm) + 30px);
		right: var(--space-sm);
		min-width: 200px;
		max-height: 240px;
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		z-index: 10;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		font-size: 0.8125rem;
		border-bottom: 1px solid var(--color-border);
		cursor: pointer;
		transition: background 0.15s;
	}

	.dropdown-item:last-child {
		border-bottom: none;
	}

	.dropdown-item:hover {
		background: var(--color-bg);
	}

	.dropdown-check {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 4px;
		border: 1.5px solid var(--color-border);
		flex-shrink: 0;
		transition: background 0.15s, border-color 0.15s;
	}

	.dropdown-check.checked {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.dropdown-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dropdown-empty {
		padding: var(--space-md);
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}
</style>
