import type { OAuthSession } from '@atproto/oauth-client-browser';
import { db } from './db';
import { syncFromPDS, resolveFollowMetadata, handleExpiredAuth } from './pds';
import { flushQueue } from './writeQueue';

type SyncStatus = 'idle' | 'syncing' | 'tailing' | 'error';

let status = $state<SyncStatus>('idle');
let error = $state<string | null>(null);
let hasLocalData = $state(false);

async function checkHasLocalData(): Promise<boolean> {
	try {
		const entry = await db.cacheMetadata.get('pds-sync');
		return !!entry;
	} catch {
		return false;
	}
}

let inflight: Promise<void> | null = null;

async function doSync(session: OAuthSession): Promise<void> {
	status = 'syncing';
	error = null;
	try {
		await flushQueue(session);
		await syncFromPDS(session, {
			onCheckpoint: () => {
				hasLocalData = true;
				status = 'tailing';
			}
		});
		await resolveFollowMetadata(session);
		status = 'idle';
	} catch (e: any) {
		if (await handleExpiredAuth(e)) {
			// logout triggered — leave state as-is; the auth redirect takes over
			return;
		}
		console.error('PDS sync failed:', e);
		hasLocalData = await checkHasLocalData();
		error = e?.message || 'Sync failed';
		status = 'error';
	}
}

function runSync(session: OAuthSession): Promise<void> {
	// Coalesce concurrent calls: the online listener or a rapid retry click
	// must not start a second sync while one is in flight, since both would
	// race on clear()+bulkAdd and corrupt the local DB.
	if (inflight) return inflight;
	inflight = doSync(session).finally(() => {
		inflight = null;
	});
	return inflight;
}

export const sync = {
	get status() {
		return status;
	},
	get error() {
		return error;
	},
	get hasLocalData() {
		return hasLocalData;
	},
	get isFirstSync() {
		return status === 'syncing' && !hasLocalData;
	},
	get isTailing() {
		return status === 'tailing';
	},

	async init(session: OAuthSession) {
		hasLocalData = await checkHasLocalData();
		await runSync(session);
	},

	async retry(session: OAuthSession) {
		await runSync(session);
	}
};
