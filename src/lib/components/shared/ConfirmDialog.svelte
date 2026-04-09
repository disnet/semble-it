<script lang="ts">
	let {
		message,
		confirmLabel = 'Delete',
		onconfirm,
		oncancel
	}: {
		message: string;
		confirmLabel?: string;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="confirm-overlay" onclick={oncancel} onkeydown={() => {}}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="confirm-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
		<p class="confirm-text">{message}</p>
		<div class="confirm-actions">
			<button class="action-btn" onclick={oncancel}>Cancel</button>
			<button class="action-btn danger" onclick={onconfirm}>{confirmLabel}</button>
		</div>
	</div>
</div>

<style>
	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 300;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-md);
	}

	.confirm-dialog {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		max-width: 360px;
		width: 100%;
		box-shadow: var(--shadow-lg);
	}

	.confirm-text {
		font-size: 0.9375rem;
		line-height: 1.5;
		margin-bottom: var(--space-md);
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
	}

	.action-btn {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
		transition: background 0.15s;
	}

	.action-btn:hover {
		background: var(--color-bg);
	}

	.action-btn.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}

	.action-btn.danger:hover {
		background: var(--color-danger-light);
	}
</style>
