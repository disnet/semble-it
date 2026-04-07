<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';

	// Layout handles auth init. Once loaded, redirect to cards or login.
	$effect(() => {
		if (!auth.loading) {
			if (auth.isLoggedIn) {
				goto('/cards', { replaceState: true });
			} else {
				goto('/login', { replaceState: true });
			}
		}
	});
</script>
