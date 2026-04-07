<script lang="ts">
	import { Menu } from 'lucide-svelte';
	import { sidebarState } from '$lib/sidebar-state.svelte';
	import type { Snippet } from 'svelte';

	let { title = '', actions }: { title?: string; actions?: Snippet } = $props();
</script>

<header class="page-header">
	<button class="menu-btn" onclick={() => sidebarState.toggle()} aria-label="Open menu">
		<Menu size={24} />
	</button>
	<h2 class="page-title">{title}</h2>
	{#if actions}
		<div class="header-actions">
			{@render actions()}
		</div>
	{/if}
</header>

<style>
	.page-header {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		height: var(--header-height);
		padding: 0 var(--space-md);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		transition: background 0.15s;
	}

	.menu-btn:hover {
		background: var(--color-primary-light);
	}

	.page-title {
		flex: 1;
		font-size: 1.125rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}
</style>
