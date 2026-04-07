<script lang="ts">
	import { goto } from '$app/navigation';
	import { Plus } from 'lucide-svelte';
</script>

<div class="fab-container">
	<button class="fab-btn" onclick={() => goto('/cards/new')} aria-label="Add card">
		<Plus size={28} />
	</button>
</div>

<style>
	.fab-container {
		position: fixed;
		bottom: var(--space-lg);
		right: var(--space-lg);
		z-index: 80;
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
		transition: background 0.15s;
	}

	.fab-btn:hover {
		background: var(--color-primary-hover);
	}
</style>
