<script lang="ts">
	import type { CardType } from '$lib/types';

	let { type }: { type: CardType } = $props();
</script>

<span class="badge" class:url={type === 'URL'} class:note={type === 'NOTE'}>
	{type}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.url {
		background: var(--color-url-bg);
		color: var(--color-url);
	}

	.note {
		background: var(--color-note-bg);
		color: var(--color-note);
	}
</style>
