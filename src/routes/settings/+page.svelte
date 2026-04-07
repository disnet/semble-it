<script lang="ts">
	import { db } from '$lib/db';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';

	let importing = $state(false);
	let exportStatus = $state('');

	async function exportData() {
		const [cards, collections, collectionCards, connections] = await Promise.all([
			db.cards.toArray(),
			db.collections.toArray(),
			db.collectionCards.toArray(),
			db.connections.toArray()
		]);

		const data = { cards, collections, collectionCards, connections, exportedAt: new Date().toISOString() };
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = `assemble-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);

		exportStatus = 'Exported!';
		setTimeout(() => (exportStatus = ''), 2000);
	}

	async function importData() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;

			importing = true;
			try {
				const text = await file.text();
				const data = JSON.parse(text);

				await db.transaction('rw', [db.cards, db.collections, db.collectionCards, db.connections], async () => {
					if (data.cards) await db.cards.bulkPut(data.cards);
					if (data.collections) await db.collections.bulkPut(data.collections);
					if (data.collectionCards) await db.collectionCards.bulkPut(data.collectionCards);
					if (data.connections) await db.connections.bulkPut(data.connections);
				});

				exportStatus = 'Imported!';
				setTimeout(() => (exportStatus = ''), 2000);
			} catch (e) {
				exportStatus = 'Import failed: invalid file';
				setTimeout(() => (exportStatus = ''), 3000);
			} finally {
				importing = false;
			}
		};
		input.click();
	}

	let confirmClear = $state(false);

	async function clearAllData() {
		await db.transaction('rw', [db.cards, db.collections, db.collectionCards, db.connections], async () => {
			await db.cards.clear();
			await db.collections.clear();
			await db.collectionCards.clear();
			await db.connections.clear();
		});
		confirmClear = false;
		exportStatus = 'All data cleared';
		setTimeout(() => (exportStatus = ''), 2000);
	}
</script>

<PageHeader title="Settings" />

<div class="settings-container">
	<section class="settings-section">
		<h3 class="section-title">Data</h3>

		<button class="settings-btn" onclick={exportData}>
			Export Data
			<span class="settings-desc">Download all cards, collections, and connections as JSON</span>
		</button>

		<button class="settings-btn" onclick={importData} disabled={importing}>
			{importing ? 'Importing…' : 'Import Data'}
			<span class="settings-desc">Import from a previously exported JSON file</span>
		</button>

		<button class="settings-btn danger" onclick={() => (confirmClear = true)}>
			Clear All Data
			<span class="settings-desc">Permanently delete all local data</span>
		</button>

		{#if exportStatus}
			<p class="status-msg">{exportStatus}</p>
		{/if}
	</section>

	<section class="settings-section">
		<h3 class="section-title">About</h3>
		<p class="about-text">
			Assemble is a local-first frontend for managing semble cards, collections, and connections. All data is stored on your device.
		</p>
	</section>
</div>

{#if confirmClear}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="confirm-overlay" onclick={() => (confirmClear = false)} onkeydown={() => {}}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="confirm-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<p class="confirm-text">Are you sure? This will permanently delete all cards, collections, connections, and their relationships. This cannot be undone.</p>
			<div class="confirm-actions">
				<button class="action-btn" onclick={() => (confirmClear = false)}>Cancel</button>
				<button class="action-btn danger" onclick={clearAllData}>Clear Everything</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-container {
		padding: var(--space-md);
		max-width: 600px;
	}

	.settings-section {
		margin-bottom: var(--space-xl);
	}

	.section-title {
		font-size: 0.9375rem;
		font-weight: 600;
		margin-bottom: var(--space-md);
		color: var(--color-text);
	}

	.settings-btn {
		display: block;
		width: 100%;
		text-align: left;
		padding: var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 500;
		margin-bottom: var(--space-sm);
		transition: background 0.15s;
	}

	.settings-btn:hover:not(:disabled) {
		background: var(--color-bg);
	}

	.settings-btn:disabled {
		opacity: 0.6;
	}

	.settings-btn.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}

	.settings-btn.danger:hover {
		background: var(--color-danger-light);
	}

	.settings-desc {
		display: block;
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--color-text-secondary);
		margin-top: 2px;
	}

	.status-msg {
		font-size: 0.875rem;
		color: var(--color-primary);
		font-weight: 500;
		margin-top: var(--space-sm);
	}

	.about-text {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

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
