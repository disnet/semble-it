<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import type { Card } from '$lib/types';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import ScrollSentinel from '$lib/components/shared/ScrollSentinel.svelte';

	const PAGE_SIZE = 20;
	let visibleCount = $state(PAGE_SIZE);

	const connections = liveQuery(() => db.connections.orderBy('createdAt').reverse().toArray());
	const allCards = liveQuery(() => db.cards.toArray());

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
</script>

<PageHeader title="Connections" />

<div class="connection-container">
	{#if ($connections ?? []).length === 0}
		<div class="empty-state">
			<p class="empty-title">No connections yet</p>
			<p class="empty-text">Connect cards to show how they relate to each other</p>
		</div>
	{:else}
		<div class="connection-list">
			{#each ($connections ?? []).slice(0, visibleCount) as conn (conn.connectionId)}
				<a href="/connections/{conn.connectionId}" class="connection-item">
					<span class="conn-source">{getEndpointName(conn.sourceCardId)}</span>
					<span class="conn-type-badge">{conn.type}</span>
					<span class="conn-target">{getEndpointName(conn.targetCardId)}</span>
				</a>
			{/each}
			{#if visibleCount < ($connections ?? []).length}
				<ScrollSentinel onVisible={() => (visibleCount += PAGE_SIZE)} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.connection-container {
		padding: var(--space-md);
		padding-bottom: var(--space-md);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-xl) var(--space-md);
	}

	.empty-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: var(--space-xs);
	}

	.empty-text {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.connection-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.connection-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
		color: var(--color-text);
		transition: box-shadow 0.15s;
	}

	.connection-item:hover {
		box-shadow: var(--shadow-md);
	}

	.conn-source,
	.conn-target {
		flex: 1;
		font-size: 0.8125rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.conn-type-badge {
		flex-shrink: 0;
		padding: 2px 8px;
		background: var(--color-primary-light);
		color: var(--color-primary);
		border-radius: var(--radius-full);
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
	}
</style>
