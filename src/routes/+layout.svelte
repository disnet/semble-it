<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/auth.svelte';
	import { syncFromPDS, handleExpiredAuth, resolveFollowMetadata } from '$lib/pds';
	import { flushQueue } from '$lib/writeQueue';
	import { openDb } from '$lib/db';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import NavPicker from '$lib/components/layout/NavPicker.svelte';


	let { children } = $props();

	const isLoginPage = $derived($page.url.pathname === '/login');
	const isLandingPage = $derived($page.url.pathname === '/');
	const isPublicPage = $derived(isLoginPage || isLandingPage);

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
			openDb(auth.session.did);
			// Flush any pending writes from previous sessions, then sync
			const session = auth.session;
			flushQueue(session)
				.then(() => syncFromPDS(session))
				.then(() => resolveFollowMetadata(session))
				.catch(async (e) => {
					if (!(await handleExpiredAuth(e))) {
						console.error('PDS sync failed:', e);
					}
				});

			// When connectivity returns, flush pending writes then sync
			window.addEventListener('online', () => {
				if (auth.session) {
					flushQueue(auth.session)
						.then(() => syncFromPDS(auth.session!))
						.then(() => resolveFollowMetadata(auth.session!))
						.catch(console.error);
				}
			});
		}
		if (!auth.isLoggedIn && !isPublicPage) {
			goto('/login', { replaceState: true });
		}
	});

	// Redirect to login if session is lost
	$effect(() => {
		if (!auth.loading && !auth.isLoggedIn && !isPublicPage) {
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
{:else if isPublicPage && !auth.isLoggedIn}
	{@render children()}
{:else if auth.isLoggedIn}
	<Sidebar />
	<NavPicker />

	<main class="main-content">
		{@render children()}
	</main>

{/if}

<style>
	.main-content {
		min-height: 100dvh;
	}

	@media (min-width: 768px) {
		.main-content {
			margin-left: var(--sidebar-width);
		}
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
