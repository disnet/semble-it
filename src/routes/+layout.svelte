<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/auth.svelte';
	import { sync } from '$lib/sync.svelte';
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
			sync.init(auth.session);

			// When connectivity returns, retry the sync
			window.addEventListener('online', () => {
				if (auth.session) sync.retry(auth.session);
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
	{#if sync.isFirstSync}
		<div class="loading-screen">
			<p class="loading-text">Fetching your collections…</p>
		</div>
	{:else if sync.status === 'error' && !sync.hasLocalData}
		<div class="loading-screen">
			<div class="sync-error">
				<p class="sync-error-title">Couldn't load your data</p>
				<p class="sync-error-message">{sync.error ?? 'Something went wrong while syncing from your PDS.'}</p>
				<button
					class="sync-error-retry"
					onclick={() => auth.session && sync.retry(auth.session)}
				>
					Retry
				</button>
			</div>
		</div>
	{:else}
		<Sidebar />
		<NavPicker />

		{#if sync.status === 'error' && sync.hasLocalData}
			<div class="sync-banner sync-banner-error">
				<span>Couldn't refresh from PDS — showing cached data.</span>
				<button
					class="sync-banner-retry"
					onclick={() => auth.session && sync.retry(auth.session)}
				>
					Retry
				</button>
			</div>
		{:else if sync.isTailing}
			<div class="sync-banner sync-banner-info">
				<span class="sync-spinner" aria-hidden="true"></span>
				<span>Loading the rest of your library…</span>
			</div>
		{/if}

		<main
			class="main-content"
			class:with-banner={(sync.status === 'error' && sync.hasLocalData) || sync.isTailing}
		>
			{@render children()}
		</main>
	{/if}
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

	.sync-error {
		max-width: 24rem;
		padding: 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.sync-error-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.sync-error-message {
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.sync-error-retry {
		margin-top: 0.5rem;
		padding: 0.5rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: white;
		background: var(--color-accent, #4f46e5);
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
	}

	.sync-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		border-bottom: 1px solid transparent;
	}

	.sync-banner-error {
		background: #fef3c7;
		color: #78350f;
		border-bottom-color: #fcd34d;
	}

	.sync-banner-info {
		background: #eef2ff;
		color: #3730a3;
		border-bottom-color: #c7d2fe;
	}

	.sync-spinner {
		width: 0.875rem;
		height: 0.875rem;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		display: inline-block;
		animation: sync-spin 0.8s linear infinite;
	}

	@keyframes sync-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (min-width: 768px) {
		.sync-banner {
			left: var(--sidebar-width);
		}
	}

	.sync-banner-retry {
		padding: 0.25rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		background: #78350f;
		color: white;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
	}

	.main-content.with-banner {
		padding-top: 2.25rem;
	}
</style>
