<script lang="ts">
	import { goto } from '$app/navigation';
	import { Plus, ChevronDown } from 'lucide-svelte';
	import { navPickerState } from '$lib/nav-picker-state.svelte';
	import type { Snippet } from 'svelte';

	let {
		title = '',
		pickable = false,
		actions
	}: { title?: string; pickable?: boolean; actions?: Snippet } = $props();
</script>

<header class="page-header">
	{#if pickable}
		<button
			class="page-title picker-trigger"
			onclick={() => navPickerState.toggle()}
			aria-label="Switch view"
			aria-haspopup="dialog"
		>
			<span class="title-text">{title}</span>
			<ChevronDown size={18} class="title-chevron" />
		</button>
	{:else}
		<h2 class="page-title">{title}</h2>
	{/if}
	{#if actions}
		<div class="header-actions">
			{@render actions()}
		</div>
	{/if}
	<button class="add-btn" onclick={() => goto('/cards/new')} aria-label="Add card">
		<Plus size={22} />
	</button>
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

	.page-title {
		flex: 1;
		font-size: 1.125rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.picker-trigger {
		display: flex;
		align-items: center;
		gap: 4px;
		background: none;
		padding: 6px 10px;
		margin: 0 -10px;
		border-radius: var(--radius-md);
		color: var(--color-text);
		cursor: pointer;
		transition: background 0.15s;
	}

	.picker-trigger:hover,
	.picker-trigger:active {
		background: var(--color-primary-light);
	}

	.picker-trigger .title-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (min-width: 768px) {
		.picker-trigger {
			pointer-events: none;
		}
		.picker-trigger :global(.title-chevron) {
			display: none;
		}
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		color: white;
		transition: background 0.15s;
	}

	.add-btn:hover {
		background: var(--color-primary-hover);
	}
</style>
