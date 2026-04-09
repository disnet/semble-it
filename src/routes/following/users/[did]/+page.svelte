<script lang="ts">
	import { page } from '$app/stores';
	import { fetchRemoteRecords } from '$lib/pds';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import ScrollSentinel from '$lib/components/shared/ScrollSentinel.svelte';

	const did = $derived($page.params.did!);

	const PAGE_SIZE = 20;
	let visibleCount = $state(PAGE_SIZE);

	let profile = $state<{ displayName?: string; handle?: string; avatar?: string } | null>(null);
	let collections = $state<Array<{ uri: string; name: string; description?: string }>>([]);
	let loading = $state(true);

	$effect(() => {
		const currentDid = did;
		loading = true;
		visibleCount = PAGE_SIZE;
		profile = null;
		collections = [];

		Promise.all([
			fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(currentDid)}`)
				.then((r) => (r.ok ? r.json() : null))
				.catch(() => null),
			fetchRemoteRecords(currentDid, 'network.cosmik.collection')
		]).then(([profileData, collectionRecords]) => {
			if (profileData) {
				profile = {
					displayName: profileData.displayName,
					handle: profileData.handle,
					avatar: profileData.avatar
				};
			}
			collections = collectionRecords.map((r) => ({
				uri: r.uri,
				name: (r.value.name as string) || 'Untitled',
				description: r.value.description as string | undefined
			}));
			loading = false;
		});
	});

	const displayName = $derived(profile?.displayName || profile?.handle || did);
</script>

<PageHeader title={displayName} />

<div class="detail-container">
	{#if loading}
		<p class="loading-text">Loading...</p>
	{:else}
		<div class="profile-section">
			{#if profile?.avatar}
				<img class="profile-avatar" src={profile.avatar} alt="" />
			{/if}
			<div class="profile-info">
				{#if profile?.displayName}
					<div class="profile-name">{profile.displayName}</div>
				{/if}
				{#if profile?.handle}
					<div class="profile-handle">@{profile.handle}</div>
				{/if}
			</div>
		</div>

		<section class="card-section">
			<h4 class="section-title">{collections.length} collection{collections.length !== 1 ? 's' : ''}</h4>
			{#if collections.length === 0}
				<p class="section-empty">No collections found</p>
			{:else}
				<div class="collection-list">
					{#each collections.slice(0, visibleCount) as col (col.uri)}
						<a href="/following/collections/{encodeURIComponent(col.uri)}" class="collection-item">
							<span class="collection-dot"></span>
							<div class="collection-item-body">
								<div class="collection-name">{col.name}</div>
								{#if col.description}
									<div class="collection-desc">{col.description}</div>
								{/if}
							</div>
						</a>
					{/each}
					{#if visibleCount < collections.length}
						<ScrollSentinel onVisible={() => (visibleCount += PAGE_SIZE)} />
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.detail-container {
		padding: var(--space-md);
		max-width: 600px;
	}

	.loading-text {
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.profile-section {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
	}

	.profile-avatar {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.profile-name {
		font-size: 1.125rem;
		font-weight: 600;
	}

	.profile-handle {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.card-section {
		border-top: 1px solid var(--color-border);
		padding-top: var(--space-md);
	}

	.section-title {
		font-size: 0.9375rem;
		font-weight: 600;
		margin-bottom: var(--space-sm);
	}

	.section-empty {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.collection-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding-bottom: var(--space-md);
	}

	.collection-item {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		box-shadow: var(--shadow-sm);
		transition: box-shadow 0.15s;
	}

	.collection-item:hover {
		box-shadow: var(--shadow-md);
	}

	.collection-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-primary);
		flex-shrink: 0;
		margin-top: 6px;
	}

	.collection-item-body {
		flex: 1;
		min-width: 0;
	}

	.collection-name {
		font-weight: 500;
		font-size: 0.9375rem;
	}

	.collection-desc {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
