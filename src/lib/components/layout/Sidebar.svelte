<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { sidebarState } from '$lib/sidebar-state.svelte';
	import { auth } from '$lib/auth.svelte';
	import { LayoutGrid, Settings, Plus, LogOut, Users } from 'lucide-svelte';

	const collections = liveQuery(() => db.collections.orderBy('name').toArray());
	const followedUsers = liveQuery(() => db.follows.where('subjectType').equals('user').toArray());
	const followedCollections = liveQuery(() =>
		db.follows.where('subjectType').equals('collection').toArray()
	);

	function close() {
		sidebarState.open = false;
	}

	function isActive(path: string): boolean {
		return $page.url.pathname === path;
	}
</script>

{#if sidebarState.open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="overlay" onclick={close} onkeydown={() => {}}></div>
{/if}

<nav class="sidebar" class:open={sidebarState.open}>
	<div class="sidebar-header">
		<h1 class="logo">SembleIt</h1>
	</div>

	<div class="sidebar-content">
		<a href="/cards" class="nav-item" class:active={isActive('/cards')} onclick={close}>
			<LayoutGrid size={20} />
			<span>All Cards</span>
		</a>

		<div class="divider"></div>

		<div class="section-label">Collections</div>

		{#if $collections}
			{#each $collections as collection}
				<a
					href="/collections/{collection.collectionId}"
					class="nav-item"
					class:active={isActive(`/collections/${collection.collectionId}`)}
					onclick={close}
				>
					<span class="collection-dot"></span>
					<span>{collection.name}</span>
				</a>
			{/each}
		{/if}

		<a href="/collections/new" class="nav-item new-collection" onclick={close}>
			<Plus size={16} />
			<span>New Collection</span>
		</a>

		{#if ($followedUsers && $followedUsers.length > 0) || ($followedCollections && $followedCollections.length > 0)}
			<div class="divider"></div>
			<div class="section-label">Following</div>

			{#if $followedUsers}
				{#each $followedUsers as follow}
					<a
						href="/following/users/{follow.subject}"
						class="nav-item"
						class:active={isActive(`/following/users/${follow.subject}`)}
						onclick={close}
					>
						{#if follow.avatarUrl}
							<img class="follow-avatar" src={follow.avatarUrl} alt="" />
						{:else}
							<Users size={16} />
						{/if}
						<span>{follow.displayName ?? follow.subject}</span>
					</a>
				{/each}
			{/if}

			{#if $followedCollections}
				{#each $followedCollections as follow}
					<a
						href="/following/collections/{encodeURIComponent(follow.subject)}"
						class="nav-item"
						class:active={isActive(`/following/collections/${encodeURIComponent(follow.subject)}`)}
						onclick={close}
					>
						<span class="collection-dot"></span>
						<span>{follow.displayName ?? 'Collection'}</span>
					</a>
				{/each}
			{/if}
		{/if}

		<div class="divider"></div>

		<a href="/settings" class="nav-item" class:active={isActive('/settings')} onclick={close}>
			<Settings size={20} />
			<span>Settings</span>
		</a>

		<button class="nav-item logout" onclick={async () => { close(); await auth.logout(); goto('/login'); }}>
			<LogOut size={20} />
			<span>Sign out</span>
		</button>
	</div>

	{#if auth.did}
		<div class="sidebar-footer">
			{#if auth.avatar}
				<img class="user-avatar" src={auth.avatar} alt="" />
			{/if}
			<span class="user-handle" title={auth.did}>@{auth.handle ?? auth.did}</span>
		</div>
	{/if}
</nav>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 90;
		-webkit-backdrop-filter: blur(2px);
		backdrop-filter: blur(2px);
	}

	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: var(--sidebar-width);
		background: var(--color-surface);
		z-index: 100;
		transform: translateX(-100%);
		transition: transform 0.25s ease;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-lg);
	}

	.sidebar.open {
		transform: translateX(0);
	}

	.sidebar-header {
		padding: var(--space-lg) var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.logo {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-sm) 0;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text);
		text-decoration: none;
		border-radius: var(--radius-md);
		margin: 2px var(--space-sm);
		font-size: 0.9375rem;
		transition: background 0.15s;
	}

	.nav-item:hover {
		background: var(--color-primary-light);
	}

	.nav-item.active {
		background: var(--color-primary-light);
		color: var(--color-primary);
		font-weight: 600;
	}

	.new-collection {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.divider {
		height: 1px;
		background: var(--color-border);
		margin: var(--space-sm) var(--space-md);
	}

	.section-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: var(--space-sm) var(--space-md);
	}

	.follow-avatar {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		flex-shrink: 0;
		object-fit: cover;
	}

	.collection-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-primary);
		flex-shrink: 0;
	}

	.logout {
		color: var(--color-text-secondary);
	}

	.sidebar-footer {
		padding: var(--space-sm) var(--space-md);
		border-top: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.user-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		flex-shrink: 0;
		object-fit: cover;
	}

	.user-handle {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
