<script lang="ts">
	import type { Card } from '$lib/types';
	import CardTypeBadge from './CardTypeBadge.svelte';

	let { card }: { card: Card } = $props();

	function getTitle(card: Card): string {
		switch (card.type) {
			case 'URL':
				return card.title || card.url;
			case 'NOTE':
				return card.text.slice(0, 100);
			case 'HIGHLIGHT':
				return card.text.slice(0, 100);
		}
	}

	function getSubtitle(card: Card): string {
		switch (card.type) {
			case 'URL':
				return card.description || card.url;
			case 'NOTE':
				return card.text.length > 100 ? card.text.slice(100, 200) + '…' : '';
			case 'HIGHLIGHT':
				return card.sourceTitle || card.sourceUrl;
		}
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<a href="/cards/{card.cardId}" class="card-item">
	<div class="card-item-header">
		<CardTypeBadge type={card.type} />
		<span class="card-date">{formatDate(card.createdAt)}</span>
	</div>
	<div class="card-title">{getTitle(card)}</div>
	{#if getSubtitle(card)}
		<div class="card-subtitle">{getSubtitle(card)}</div>
	{/if}
</a>

<style>
	.card-item {
		display: block;
		padding: var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		box-shadow: var(--shadow-sm);
		transition: box-shadow 0.15s;
	}

	.card-item:hover {
		box-shadow: var(--shadow-md);
	}

	.card-item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-xs);
	}

	.card-date {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
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
</style>
