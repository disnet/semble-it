<script lang="ts">
	import CardTypeBadge from './CardTypeBadge.svelte';

	let { value }: { value: Record<string, unknown> } = $props();

	const cardType = $derived((value.type as string) ?? 'NOTE');

	const title = $derived.by(() => {
		if (cardType === 'URL') {
			const content = value.content as Record<string, unknown> | undefined;
			const metadata = content?.metadata as Record<string, unknown> | undefined;
			return (metadata?.title as string) || (content?.url as string) || (value.url as string) || '';
		}
		const content = value.content as Record<string, unknown> | undefined;
		return ((content?.text as string) || '').slice(0, 100);
	});

	const subtitle = $derived.by(() => {
		if (cardType === 'URL') {
			const content = value.content as Record<string, unknown> | undefined;
			const metadata = content?.metadata as Record<string, unknown> | undefined;
			return (metadata?.description as string) || (content?.url as string) || (value.url as string) || '';
		}
		const content = value.content as Record<string, unknown> | undefined;
		const text = (content?.text as string) || '';
		return text.length > 100 ? text.slice(100, 200) + '\u2026' : '';
	});

	const imageUrl = $derived.by(() => {
		if (cardType !== 'URL') return undefined;
		const content = value.content as Record<string, unknown> | undefined;
		const metadata = content?.metadata as Record<string, unknown> | undefined;
		return (metadata?.imageUrl as string) || undefined;
	});

	const externalUrl = $derived.by(() => {
		if (cardType !== 'URL') return undefined;
		const content = value.content as Record<string, unknown> | undefined;
		return (content?.url as string) || (value.url as string) || undefined;
	});
</script>

{#if externalUrl}
	<a href={externalUrl} target="_blank" rel="noopener noreferrer" class="card-item" class:has-image={!!imageUrl}>
		{#if imageUrl}
			<img src={imageUrl} alt="" class="card-image" />
		{/if}
		<div class="card-item-body">
			<div class="card-item-header">
				<CardTypeBadge type={cardType === 'URL' ? 'URL' : 'NOTE'} />
			</div>
			<div class="card-title">{title}</div>
			{#if subtitle}
				<div class="card-subtitle">{subtitle}</div>
			{/if}
		</div>
	</a>
{:else}
	<div class="card-item">
		<div class="card-item-body">
			<div class="card-item-header">
				<CardTypeBadge type="NOTE" />
			</div>
			<div class="card-title">{title}</div>
			{#if subtitle}
				<div class="card-subtitle">{subtitle}</div>
			{/if}
		</div>
	</div>
{/if}

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

	.card-item.has-image {
		display: flex;
		align-items: stretch;
		gap: var(--space-md);
	}

	a.card-item:hover {
		box-shadow: var(--shadow-md);
	}

	.card-image {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}

	.card-item-body {
		flex: 1;
		min-width: 0;
	}

	.card-item-header {
		display: flex;
		align-items: center;
		margin-bottom: var(--space-xs);
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
