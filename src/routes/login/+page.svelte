<script lang="ts">
	import { auth } from '$lib/auth.svelte';

	type Suggestion = {
		did: string;
		handle: string;
		displayName?: string;
		avatar?: string;
	};

	let handle = $state('');
	let loggingIn = $state(false);
	let suggestions = $state<Suggestion[]>([]);
	let showSuggestions = $state(false);
	let activeIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let searchSeq = 0;

	async function fetchSuggestions(q: string) {
		const seq = ++searchSeq;
		try {
			const res = await fetch(
				`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(q)}&limit=8`
			);
			if (!res.ok) return;
			const data = await res.json();
			if (seq !== searchSeq) return;
			suggestions = (data.actors ?? []) as Suggestion[];
			activeIndex = -1;
		} catch {
			// ignore network errors — autocomplete is best-effort
		}
	}

	function onInput() {
		const q = handle.trim().replace(/^@/, '');
		clearTimeout(debounceTimer);
		if (!q) {
			suggestions = [];
			showSuggestions = false;
			return;
		}
		showSuggestions = true;
		debounceTimer = setTimeout(() => fetchSuggestions(q), 200);
	}

	function pick(s: Suggestion) {
		handle = s.handle;
		suggestions = [];
		showSuggestions = false;
		activeIndex = -1;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!showSuggestions || suggestions.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
		} else if (e.key === 'Enter' && activeIndex >= 0) {
			e.preventDefault();
			pick(suggestions[activeIndex]);
		} else if (e.key === 'Escape') {
			showSuggestions = false;
			activeIndex = -1;
		}
	}

	async function login() {
		if (!handle.trim()) return;
		loggingIn = true;
		try {
			await auth.login(handle.trim());
		} catch {
			loggingIn = false;
		}
	}
</script>

<div class="login-page">
	<div class="login-card">
		<h1 class="login-title">SembleIt</h1>
		<p class="login-subtitle">Local-first card manager for semble</p>

		<form class="login-form" onsubmit={(e) => { e.preventDefault(); login(); }}>
			<label class="field">
				<span class="field-label">Atmosphere Account</span>
				<div class="field-wrap">
					<input
						type="text"
						bind:value={handle}
						oninput={onInput}
						onkeydown={onKeydown}
						onfocus={() => { if (suggestions.length) showSuggestions = true; }}
						onblur={() => setTimeout(() => { showSuggestions = false; }, 150)}
						placeholder="you.bsky.social"
						class="field-input"
						autocapitalize="none"
						autocorrect="off"
						spellcheck="false"
						autocomplete="off"
						role="combobox"
						aria-expanded={showSuggestions && suggestions.length > 0}
						aria-autocomplete="list"
						aria-controls="handle-suggestions"
					/>
					{#if showSuggestions && suggestions.length > 0}
						<ul id="handle-suggestions" class="suggestions" role="listbox">
							{#each suggestions as s, i (s.did)}
								<li
									class="suggestion"
									class:active={i === activeIndex}
									role="option"
									aria-selected={i === activeIndex}
									onmousedown={(e) => { e.preventDefault(); pick(s); }}
								>
									{#if s.avatar}
										<img src={s.avatar} alt="" class="suggestion-avatar" />
									{:else}
										<div class="suggestion-avatar suggestion-avatar-empty"></div>
									{/if}
									<div class="suggestion-text">
										{#if s.displayName}
											<div class="suggestion-name">{s.displayName}</div>
										{/if}
										<div class="suggestion-handle">@{s.handle}</div>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</label>

			{#if auth.error}
				<p class="error-msg">{auth.error}</p>
			{/if}

			<button class="login-btn" type="submit" disabled={loggingIn || !handle.trim()}>
				{loggingIn ? 'Redirecting…' : 'Login'}
			</button>
		</form>

		<p class="login-note">
			Login with your Atmosphere Account (Bluesky, Blacksky, Tangled, etc.). You'll be redirected to your AT Protocol server to authorize access.
		</p>
	</div>
</div>

<style>
	.login-page {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-md);
		background: var(--color-bg);
	}

	.login-card {
		width: 100%;
		max-width: 380px;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
		box-shadow: var(--shadow-md);
	}

	.login-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-primary);
		margin-bottom: var(--space-xs);
	}

	.login-subtitle {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-xl);
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.field {
		display: block;
	}

	.field-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-xs);
	}

	.field-input {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.field-input:focus {
		border-color: var(--color-primary);
	}

	.field-wrap {
		position: relative;
	}

	.suggestions {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		list-style: none;
		margin: 0;
		padding: 4px;
		max-height: 280px;
		overflow-y: auto;
		z-index: 10;
	}

	.suggestion {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.suggestion:hover,
	.suggestion.active {
		background: var(--color-bg);
	}

	.suggestion-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		flex-shrink: 0;
		object-fit: cover;
	}

	.suggestion-avatar-empty {
		background: var(--color-border);
	}

	.suggestion-text {
		min-width: 0;
		flex: 1;
	}

	.suggestion-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.suggestion-handle {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.error-msg {
		font-size: 0.8125rem;
		color: var(--color-danger);
	}

	.login-btn {
		width: 100%;
		padding: var(--space-md);
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		transition: background 0.15s;
	}

	.login-btn:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	.login-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.login-note {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-align: center;
		margin-top: var(--space-md);
		line-height: 1.4;
	}
</style>
