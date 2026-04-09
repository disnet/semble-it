<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import Picker from '$lib/components/shared/Picker.svelte';

	let {
		selected = $bindable<string | undefined>(undefined),
		excludeIds = [] as string[]
	} = $props();

	const allCollections = liveQuery(() => db.collections.orderBy('createdAt').reverse().toArray());

	let items = $derived(
		($allCollections ?? [])
			.filter((c) => !excludeIds.includes(c.collectionId))
			.map((c) => ({ ...c, id: c.collectionId, label: c.name }))
	);
</script>

<Picker bind:selected {items} placeholder="Add to collection…" />
