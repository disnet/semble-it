<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { getCardLabel } from '$lib/utils';
	import CardTypeBadge from './CardTypeBadge.svelte';
	import Picker from '$lib/components/shared/Picker.svelte';

	let {
		selected = $bindable<string | undefined>(undefined),
		excludeId = undefined as string | undefined,
		excludeIds = [] as string[],
		label = 'Select a card'
	} = $props();

	const allCards = liveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());

	let items = $derived(
		($allCards ?? [])
			.filter((c) => c.cardId !== excludeId && !excludeIds.includes(c.cardId))
			.map((c) => ({ ...c, id: c.cardId, label: getCardLabel(c) }))
	);
</script>

<Picker bind:selected {items} placeholder="Search cards…" {label}>
	{#snippet renderItem(item)}
		<CardTypeBadge type={item.type} />
		<span class="picker-item-label">{item.label}</span>
	{/snippet}
</Picker>

<style>
	.picker-item-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
