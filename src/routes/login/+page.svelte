<script lang="ts">
	import { auth } from '$lib/auth.svelte';

	let handle = $state('');
	let loggingIn = $state(false);

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
				<span class="field-label">Handle</span>
				<input
					type="text"
					bind:value={handle}
					placeholder="you.bsky.social"
					class="field-input"
					autocapitalize="none"
					autocorrect="off"
					spellcheck="false"
				/>
			</label>

			{#if auth.error}
				<p class="error-msg">{auth.error}</p>
			{/if}

			<button class="login-btn" type="submit" disabled={loggingIn || !handle.trim()}>
				{loggingIn ? 'Redirecting…' : 'Sign in with AT Protocol'}
			</button>
		</form>

		<p class="login-note">
			You'll be redirected to your AT Protocol server to authorize access.
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
