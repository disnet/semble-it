<script lang="ts">
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import { RefreshCw } from 'lucide-svelte';
	import { db } from '$lib/db';
	import { timeAgo } from '$lib/utils';

	let { cacheKey, onrefresh }: { cacheKey: string; onrefresh: () => Promise<void> } = $props();

	let fetchedAt = $state<Date | null>(null);
	let refreshing = $state(false);
	let tick = $state(0);

	const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

	$effect(() => {
		const key = cacheKey;
		const sub = liveQuery(() => db.cacheMetadata.get(key)).subscribe((entry) => {
			fetchedAt = entry?.fetchedAt ?? null;
		});
		return () => sub.unsubscribe();
	});

	// Auto-refresh if data is older than stale threshold
	$effect(() => {
		if (fetchedAt && !refreshing && Date.now() - fetchedAt.getTime() > STALE_MS) {
			// Schedule outside the effect so state writes aren't suppressed
			setTimeout(() => handleRefresh(), 0);
		}
	});

	// Update relative time every 60s
	onMount(() => {
		const interval = setInterval(() => (tick += 1), 60_000);
		return () => clearInterval(interval);
	});

	const label = $derived.by(() => {
		void tick;
		if (!fetchedAt) return null;
		return `Last refreshed ${timeAgo(fetchedAt)}`;
	});

	async function handleRefresh() {
		refreshing = true;
		try {
			await onrefresh();
		} finally {
			refreshing = false;
		}
	}
</script>

<div class="refresh-bar">
	{#if label}
		<span class="refresh-label">{label}</span>
	{:else}
		<span class="refresh-label">Not yet synced</span>
	{/if}
	<button class="refresh-btn" onclick={handleRefresh} disabled={refreshing} aria-label="Refresh">
		<RefreshCw size={14} class={refreshing ? 'spinning' : ''} />
	</button>
</div>

<style>
	.refresh-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-xs) var(--space-md);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.refresh-label {
		flex: 1;
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		transition: background 0.15s, color 0.15s;
	}

	.refresh-btn:hover:not(:disabled) {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
	}

	.refresh-btn :global(.spinning) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
