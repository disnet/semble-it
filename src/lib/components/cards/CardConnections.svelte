<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { queueCreateConnection, queueDeleteConnection } from '$lib/writeQueue';
	import { CONNECTION_TYPES, type ConnectionType, type Connection } from '$lib/types';
	import { isUrl } from '$lib/utils';
	import CardPicker from '$lib/components/cards/CardPicker.svelte';

	let { cardId }: { cardId: string } = $props();

	const cardConnections = liveQuery(async () => {
		const [asSource, asTarget] = await Promise.all([
			db.connections.where('sourceCardId').equals(cardId).toArray(),
			db.connections.where('targetCardId').equals(cardId).toArray()
		]);
		return { asSource, asTarget };
	});

	const allCards = liveQuery(() => db.cards.toArray());

	let newConnType = $state<ConnectionType>('RELATED');
	let newConnTarget = $state<string | undefined>(undefined);
	let creatingConn = $state(false);
	let confirmDeleteConn = $state<string | null>(null);

	let connectedWithType = $derived.by(() => {
		const conns = $cardConnections?.asSource ?? [];
		return conns.filter((c) => c.type === newConnType).map((c) => c.targetCardId);
	});

	$effect(() => {
		if (!newConnTarget || !newConnType || newConnTarget === cardId) return;
		const targetId = newConnTarget;
		const type = newConnType;
		newConnTarget = undefined;
		createConnection(targetId, type);
	});

	async function createConnection(targetId: string, type: ConnectionType) {
		creatingConn = true;
		try {
			const connectionId = crypto.randomUUID();
			const now = new Date();
			const connection: Connection = {
				connectionId,
				sourceCardId: cardId,
				targetCardId: targetId,
				type,
				createdAt: now,
				updatedAt: now
			};
			await queueCreateConnection(connection);
		} finally {
			creatingConn = false;
		}
	}

	async function deleteConnection(connId: string) {
		const conn = await db.connections.get(connId);
		if (conn) await queueDeleteConnection(conn);
		confirmDeleteConn = null;
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
		if (!c) return value.slice(0, 8) + '\u2026';
		if (c.type === 'URL') return c.title || c.url;
		return c.text.slice(0, 50);
	}
</script>

<section class="section">
	<div class="section-header">
		<h4 class="section-title">Connections</h4>
	</div>
	<div class="inline-conn-form">
		<select class="conn-type-select" bind:value={newConnType}>
			{#each CONNECTION_TYPES as t}
				<option value={t}>{t.replace('_', ' ')}</option>
			{/each}
		</select>
		<div class="conn-picker-wrap">
			<CardPicker bind:selected={newConnTarget} excludeId={cardId} excludeIds={connectedWithType} label="" />
		</div>
	</div>
	{#if ($cardConnections?.asSource ?? []).length === 0 && ($cardConnections?.asTarget ?? []).length === 0}
		<p class="section-empty">No connections yet</p>
	{:else}
		<div class="connection-list">
			{#each $cardConnections?.asSource ?? [] as conn}
				<div class="connection-chip">
					<a href="/connections/{conn.connectionId}" class="connection-chip-link">
						<span class="conn-type-badge">{conn.type.replace('_', ' ')}</span>
						<span class="conn-card-name">{getEndpointName(conn.targetCardId)}</span>
					</a>
					{#if confirmDeleteConn === conn.connectionId}
						<span class="conn-confirm">
							<button class="conn-confirm-btn danger" onclick={() => deleteConnection(conn.connectionId)}>Delete</button>
							<button class="conn-confirm-btn" onclick={() => (confirmDeleteConn = null)}>Cancel</button>
						</span>
					{:else}
						<button class="conn-chip-delete" onclick={() => (confirmDeleteConn = conn.connectionId)} title="Delete connection">&times;</button>
					{/if}
				</div>
			{/each}
			{#each $cardConnections?.asTarget ?? [] as conn}
				<div class="connection-chip">
					<a href="/connections/{conn.connectionId}" class="connection-chip-link">
						<span class="conn-type-badge">{conn.type.replace('_', ' ')}</span>
						<span class="conn-card-name">{getEndpointName(conn.sourceCardId)}</span>
					</a>
					{#if confirmDeleteConn === conn.connectionId}
						<span class="conn-confirm">
							<button class="conn-confirm-btn danger" onclick={() => deleteConnection(conn.connectionId)}>Delete</button>
							<button class="conn-confirm-btn" onclick={() => (confirmDeleteConn = null)}>Cancel</button>
						</span>
					{:else}
						<button class="conn-chip-delete" onclick={() => (confirmDeleteConn = conn.connectionId)} title="Delete connection">&times;</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.section {
		margin-top: var(--space-sm);
		padding-top: var(--space-sm);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-sm);
	}

	.section-title {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.section-empty {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.inline-conn-form {
		display: flex;
		gap: var(--space-sm);
		align-items: flex-start;
		margin-bottom: var(--space-md);
	}

	.conn-type-select {
		flex-shrink: 0;
		padding: var(--space-sm) var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.75rem;
		outline: none;
		transition: border-color 0.15s;
		max-width: 110px;
	}

	.conn-type-select:focus {
		border-color: var(--color-primary);
	}

	.conn-picker-wrap {
		flex: 1;
		min-width: 0;
	}

	.conn-picker-wrap :global(.picker) {
		margin-bottom: 0;
	}

	.conn-picker-wrap :global(.picker-label) {
		display: none;
	}

	.connection-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.connection-chip {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color 0.15s;
	}

	.connection-chip:hover {
		border-color: var(--color-primary);
	}

	.connection-chip-link {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		text-decoration: none;
		color: var(--color-text);
		font-size: 0.8125rem;
		min-width: 0;
	}

	.conn-type-badge {
		font-weight: 600;
		color: var(--color-primary);
		font-size: 0.6875rem;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.conn-card-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}

	.conn-chip-delete {
		flex-shrink: 0;
		width: 28px;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		border-left: 1px solid var(--color-border);
		transition: background 0.15s, color 0.15s;
	}

	.conn-chip-delete:hover {
		background: var(--color-danger-light);
		color: var(--color-danger);
	}

	.conn-confirm {
		display: flex;
		gap: var(--space-xs);
		flex-shrink: 0;
		padding: 0 var(--space-xs);
	}

	.conn-confirm-btn {
		padding: 2px 8px;
		border-radius: var(--radius-md);
		font-size: 0.6875rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
	}

	.conn-confirm-btn.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}

	.conn-confirm-btn.danger:hover {
		background: var(--color-danger-light);
	}
</style>
