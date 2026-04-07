<script lang="ts">
	import { goto } from '$app/navigation';
	import { Plus, LinkIcon, StickyNote, Highlighter } from 'lucide-svelte';

	let expanded = $state(false);

	function toggle() {
		expanded = !expanded;
	}

	function addCard(type: string) {
		expanded = false;
		goto(`/cards/new?type=${type}`);
	}
</script>

{#if expanded}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fab-overlay" onclick={() => (expanded = false)} onkeydown={() => {}}></div>
{/if}

<div class="fab-container">
	{#if expanded}
		<div class="fab-menu">
			<button class="fab-option" onclick={() => addCard('URL')}>
				<LinkIcon size={20} />
				<span>URL</span>
			</button>
			<button class="fab-option" onclick={() => addCard('NOTE')}>
				<StickyNote size={20} />
				<span>Note</span>
			</button>
			<button class="fab-option" onclick={() => addCard('HIGHLIGHT')}>
				<Highlighter size={20} />
				<span>Highlight</span>
			</button>
		</div>
	{/if}

	<button class="fab-btn" class:expanded onclick={toggle} aria-label="Add card">
		<Plus size={28} />
	</button>
</div>

<style>
	.fab-overlay {
		position: fixed;
		inset: 0;
		z-index: 70;
	}

	.fab-container {
		position: fixed;
		bottom: var(--space-lg);
		right: var(--space-lg);
		z-index: 80;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-sm);
	}

	.fab-btn {
		width: var(--fab-size);
		height: var(--fab-size);
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-lg);
		transition:
			transform 0.2s,
			background 0.15s;
	}

	.fab-btn:hover {
		background: var(--color-primary-hover);
	}

	.fab-btn.expanded {
		transform: rotate(45deg);
	}

	.fab-menu {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		animation: fab-in 0.15s ease;
	}

	.fab-option {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-full);
		box-shadow: var(--shadow-md);
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
		transition: background 0.15s;
	}

	.fab-option:hover {
		background: var(--color-primary-light);
	}

	@keyframes fab-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
