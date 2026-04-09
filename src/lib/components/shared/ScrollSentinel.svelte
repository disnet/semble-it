<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		onVisible: () => void;
	}
	let { onVisible }: Props = $props();

	let sentinel: HTMLDivElement;

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) onVisible();
			},
			{ rootMargin: '200px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<div bind:this={sentinel} class="scroll-sentinel"></div>

<style>
	.scroll-sentinel {
		height: 1px;
	}
</style>
