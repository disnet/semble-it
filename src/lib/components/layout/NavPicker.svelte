<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { auth } from '$lib/auth.svelte';
	import { navPickerState } from '$lib/nav-picker-state.svelte';
	import { LayoutGrid, Plus, LogOut, Users } from 'lucide-svelte';

	const collections = liveQuery(() => db.collections.orderBy('name').toArray());
	const followedUsers = liveQuery(() =>
		db.follows
			.where('subjectType')
			.equals('user')
			.filter((f) => !!f.displayName)
			.toArray()
	);
	const followedCollections = liveQuery(() =>
		db.follows
			.where('subjectType')
			.equals('collection')
			.filter((f) => !!f.displayName)
			.toArray()
	);

	function close() {
		navPickerState.open = false;
	}

	function isActive(path: string): boolean {
		return $page.url.pathname === path;
	}

	$effect(() => {
		if (!navPickerState.open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});
</script>

{#if navPickerState.open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={close} onkeydown={() => {}}></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Navigate">
		<div class="grabber"></div>
		<div class="sheet-content">
			<a
				href="/cards"
				class="nav-item"
				class:active={isActive('/cards')}
				onclick={close}
			>
				<LayoutGrid size={20} />
				<span>All Cards</span>
			</a>

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
							class:active={isActive(
								`/following/collections/${encodeURIComponent(follow.subject)}`
							)}
							onclick={close}
						>
							<span class="collection-dot"></span>
							<span>{follow.displayName ?? 'Collection'}</span>
						</a>
					{/each}
				{/if}
			{/if}

			<button
				class="nav-item logout"
				onclick={async () => {
					close();
					await auth.logout();
					goto('/login');
				}}
			>
				<LogOut size={20} />
				<span>Sign out</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		left: 0;
		right: 0;
		top: var(--header-height);
		bottom: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
		-webkit-backdrop-filter: blur(2px);
		backdrop-filter: blur(2px);
		animation: fade-in 0.2s ease;
		touch-action: none;
		overscroll-behavior: contain;
	}

	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		top: var(--header-height);
		z-index: 201;
		background: var(--color-surface);
		border-bottom-left-radius: 16px;
		border-bottom-right-radius: 16px;
		box-shadow: var(--shadow-lg);
		max-height: calc(80dvh - var(--header-height));
		display: flex;
		flex-direction: column;
		transform-origin: top center;
		animation: slide-down 0.22s cubic-bezier(0.2, 0, 0, 1);
	}

	.grabber {
		display: none;
	}

	.sheet-content {
		overflow-y: auto;
		padding: var(--space-sm) 0 var(--space-md);
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slide-down {
		from {
			transform: translateY(-8px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
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
		width: calc(100% - var(--space-sm) * 2);
		background: none;
		text-align: left;
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

	/* Desktop: no picker, sidebar handles nav */
	@media (min-width: 768px) {
		.backdrop,
		.sheet {
			display: none;
		}
	}
</style>
