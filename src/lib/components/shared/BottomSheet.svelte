<script lang="ts">
	import type { Snippet } from 'svelte';

	let { open = $bindable(false), title = '', children }: { open: boolean; title?: string; children: Snippet } = $props();
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="sheet-overlay" onclick={() => (open = false)} onkeydown={() => {}}></div>
	<div class="sheet">
		{#if title}
			<div class="sheet-header">
				<h3 class="sheet-title">{title}</h3>
				<button class="sheet-close" onclick={() => (open = false)}>✕</button>
			</div>
		{/if}
		<div class="sheet-content">
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.sheet-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
		-webkit-backdrop-filter: blur(2px);
		backdrop-filter: blur(2px);
	}

	.sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		max-height: 80dvh;
		background: var(--color-surface);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		z-index: 210;
		display: flex;
		flex-direction: column;
		animation: sheet-up 0.2s ease;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.sheet-title {
		font-size: 1rem;
		font-weight: 600;
	}

	.sheet-close {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		font-size: 1rem;
		color: var(--color-text-secondary);
	}

	.sheet-close:hover {
		background: var(--color-bg);
	}

	.sheet-content {
		overflow-y: auto;
		padding: var(--space-md);
	}

	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>
