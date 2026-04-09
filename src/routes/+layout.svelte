<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/auth.svelte';
	import { syncFromPDS, handleExpiredAuth } from '$lib/pds';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';


	let { children } = $props();

	const isLoginPage = $derived($page.url.pathname === '/login');
	let syncing = $state(false);

	onMount(async () => {
		// Reload when a new service worker takes control so updates are applied immediately
		let reloading = false;
		navigator.serviceWorker?.addEventListener('controllerchange', () => {
			if (!reloading) {
				reloading = true;
				window.location.reload();
			}
		});

		await auth.init();
		if (auth.isLoggedIn && auth.session) {
			syncing = true;
			try {
				await syncFromPDS(auth.session);
			} catch (e) {
				if (!(await handleExpiredAuth(e))) {
					console.error('PDS sync failed:', e);
				}
			} finally {
				syncing = false;
			}
		}
		if (!auth.isLoggedIn && !isLoginPage) {
			goto('/login', { replaceState: true });
		}
	});

	// Redirect to login if session is lost
	$effect(() => {
		if (!auth.loading && !auth.isLoggedIn && !isLoginPage) {
			goto('/login', { replaceState: true });
		}
	});
</script>

<svelte:head>
	<meta name="theme-color" content="#4f46e5" />
	<link rel="manifest" href="/manifest.json" />
</svelte:head>

{#if auth.loading}
	<div class="loading-screen">
		<p class="loading-text">Loading…</p>
	</div>
{:else if isLoginPage}
	{@render children()}
{:else if auth.isLoggedIn}
	<Sidebar />

	<main class="main-content">
		{@render children()}
	</main>

{/if}

<style>
	.main-content {
		min-height: 100dvh;
	}

	.loading-screen {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.loading-text {
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}
</style>
