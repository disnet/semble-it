import { Agent } from '@atproto/api';
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { db } from './db';
import { auth } from './auth.svelte';
import type { Card, Collection, CollectionCard, Connection, Follow, RemoteDataCache } from './types';
import { isUrl } from './utils';

function isExpiredAuthError(e: unknown): boolean {
	const status = (e as any)?.status ?? (e as any)?.response?.status;
	if (status === 401) return true;
	const message = String((e as any)?.message ?? '').toLowerCase();
	return message.includes('expired') || message.includes('invalid token') || message.includes('token revoked');
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` over `items` with at most `limit` tasks in flight at once,
 * preserving input order in the returned results. Used to bound how many
 * paginators we fan out against the PDS so we don't re-create the 429
 * pressure that `withRetry` is papering over.
 */
async function parallelMap<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (true) {
			const idx = next++;
			if (idx >= items.length) return;
			results[idx] = await fn(items[idx]);
		}
	});
	await Promise.all(workers);
	return results;
}

function isRateLimitError(e: unknown): boolean {
	const status = (e as any)?.status ?? (e as any)?.response?.status;
	return status === 429;
}

/**
 * Retry a PDS call on 429 rate-limit errors with exponential backoff.
 * Honors a `retryAfter` field on the error (seconds) when present.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (e) {
			const isLast = attempt === maxAttempts - 1;
			if (isLast || !isRateLimitError(e)) throw e;
			const retryAfter =
				(e as any)?.retryAfter ??
				(e as any)?.headers?.['retry-after'] ??
				(e as any)?.response?.headers?.['retry-after'];
			// Retry-After is usually seconds, but the spec also permits an HTTP
			// date. Number() on a date string returns NaN, which would collapse
			// the sleep to 0 and defeat the backoff — fall through to exponential
			// in that case.
			const retryAfterSec = Number(retryAfter);
			const delayMs =
				retryAfter && Number.isFinite(retryAfterSec) && retryAfterSec > 0
					? Math.min(retryAfterSec * 1000, 60000)
					: Math.min(1000 * 2 ** attempt, 30000);
			await sleep(delayMs);
		}
	}
	throw new Error('withRetry: unreachable');
}

/**
 * Check if an error indicates an expired/invalid auth session.
 * If so, trigger logout and return true.
 */
export async function handleExpiredAuth(e: unknown): Promise<boolean> {
	if (isExpiredAuthError(e)) {
		await auth.logout();
		return true;
	}
	return false;
}

export const BASE_NSID = 'network.cosmik';
export const NSID = {
	card: `${BASE_NSID}.card`,
	collection: `${BASE_NSID}.collection`,
	collectionLink: `${BASE_NSID}.collectionLink`,
	connection: `${BASE_NSID}.connection`,
	follow: `${BASE_NSID}.follow`
} as const;

export function createAgent(session: OAuthSession): Agent {
	// Wrap the session's fetchHandler to detect expired auth and trigger logout
	const wrappedSession = Object.create(session, {
		fetchHandler: {
			value: async (pathname: string, init: RequestInit) => {
				try {
					return await session.fetchHandler(pathname, init);
				} catch (e) {
					if (isExpiredAuthError(e)) {
						auth.logout();
					}
					throw e;
				}
			}
		}
	});
	return new Agent(wrappedSession);
}

export function rkeyFromUri(uri: string): string {
	return uri.split('/').pop()!;
}

export function cardAtUri(did: string, rkey: string): string {
	return `at://${did}/${NSID.card}/${rkey}`;
}

function collectionAtUri(did: string, rkey: string): string {
	return `at://${did}/${NSID.collection}/${rkey}`;
}

// --- Card: local → PDS record ---

export function cardToRecord(card: Card, parentRef?: { uri: string; cid: string }): Record<string, unknown> {
	const record: Record<string, unknown> = {
		$type: NSID.card,
		type: card.type,
		createdAt: card.createdAt instanceof Date ? card.createdAt.toISOString() : card.createdAt
	};

	if (card.type === 'URL') {
		record.url = card.url;
		record.content = {
			$type: `${BASE_NSID}.card#urlContent`,
			url: card.url,
			...(card.title || card.description
				? {
						metadata: {
							$type: `${BASE_NSID}.card#urlMetadata`,
							...(card.title && { title: card.title }),
							...(card.description && { description: card.description })
						}
					}
				: {})
		};
	} else if (card.type === 'NOTE') {
		record.content = {
			$type: `${BASE_NSID}.card#noteContent`,
			text: card.text
		};
		if (parentRef) {
			record.parentCard = { uri: parentRef.uri, cid: parentRef.cid };
		}
	}

	return record;
}

// --- Card: PDS record → local ---

function recordToCard(uri: string, cid: string, value: Record<string, unknown>): Card {
	const cardId = rkeyFromUri(uri);
	const createdAt = new Date(value.createdAt as string);
	const updatedAt = value.updatedAt ? new Date(value.updatedAt as string) : createdAt;
	const base = { cardId, createdAt, updatedAt, uri, cid };

	if (value.type === 'URL') {
		const content = value.content as Record<string, unknown>;
		const metadata = content?.metadata as Record<string, unknown> | undefined;
		return {
			...base,
			type: 'URL',
			url: (content?.url as string) || (value.url as string) || '',
			title: (metadata?.title as string | undefined) || (content?.title as string | undefined),
			description: (metadata?.description as string | undefined) || (content?.description as string | undefined),
			imageUrl: (metadata?.imageUrl as string | undefined) || (content?.imageUrl as string | undefined)
		};
	} else {
		// NOTE card
		const content = value.content as Record<string, unknown>;
		return {
			...base,
			type: 'NOTE',
			text: (content?.text as string) || '',
			parentCardId: value.parentCard
				? rkeyFromUri((value.parentCard as Record<string, unknown>).uri as string)
				: undefined
		};
	}
}

// --- Card operations ---

export async function createCardInPDS(
	session: OAuthSession,
	card: Card,
	parentRef?: { uri: string; cid: string }
): Promise<{ uri: string; cid: string }> {
	const agent = createAgent(session);
	const response = await agent.com.atproto.repo.createRecord({
		repo: session.did,
		collection: NSID.card,
		record: cardToRecord(card, parentRef)
	});
	return { uri: response.data.uri, cid: response.data.cid };
}

export async function updateCardInPDS(session: OAuthSession, card: Card): Promise<void> {
	if (!card.uri) return;
	const agent = createAgent(session);
	await agent.com.atproto.repo.putRecord({
		repo: session.did,
		collection: NSID.card,
		rkey: rkeyFromUri(card.uri),
		record: cardToRecord(card)
	});
}

export async function deleteCardFromPDS(session: OAuthSession, card: Card): Promise<void> {
	if (!card.uri) return;
	const agent = createAgent(session);
	await agent.com.atproto.repo.deleteRecord({
		repo: session.did,
		collection: NSID.card,
		rkey: rkeyFromUri(card.uri)
	});
}

// --- Collection operations ---

export function collectionToRecord(collection: Collection): Record<string, unknown> {
	return {
		$type: NSID.collection,
		name: collection.name,
		...(collection.description && { description: collection.description }),
		accessType: 'CLOSED',
		collaborators: [],
		createdAt:
			collection.createdAt instanceof Date
				? collection.createdAt.toISOString()
				: collection.createdAt,
		updatedAt:
			collection.updatedAt instanceof Date
				? collection.updatedAt.toISOString()
				: collection.updatedAt
	};
}

function recordToCollection(
	uri: string,
	cid: string,
	value: Record<string, unknown>
): Collection {
	return {
		collectionId: rkeyFromUri(uri),
		name: value.name as string,
		description: value.description as string | undefined,
		createdAt: new Date(value.createdAt as string),
		updatedAt: new Date(value.updatedAt as string),
		uri,
		cid
	};
}

export async function createCollectionInPDS(
	session: OAuthSession,
	collection: Collection
): Promise<{ uri: string; cid: string }> {
	const agent = createAgent(session);
	const response = await agent.com.atproto.repo.createRecord({
		repo: session.did,
		collection: NSID.collection,
		record: collectionToRecord(collection)
	});
	return { uri: response.data.uri, cid: response.data.cid };
}

export async function updateCollectionInPDS(
	session: OAuthSession,
	collection: Collection
): Promise<void> {
	if (!collection.uri) return;
	const agent = createAgent(session);
	await agent.com.atproto.repo.putRecord({
		repo: session.did,
		collection: NSID.collection,
		rkey: rkeyFromUri(collection.uri),
		record: collectionToRecord(collection)
	});
}

export async function deleteCollectionFromPDS(
	session: OAuthSession,
	collection: Collection
): Promise<void> {
	if (!collection.uri) return;
	const agent = createAgent(session);
	await agent.com.atproto.repo.deleteRecord({
		repo: session.did,
		collection: NSID.collection,
		rkey: rkeyFromUri(collection.uri)
	});
}

// --- CollectionLink operations ---

export async function createCollectionLinkInPDS(
	session: OAuthSession,
	card: Card,
	collection: Collection
): Promise<{ uri: string; cid: string }> {
	if (!card.uri || !card.cid || !collection.uri || !collection.cid) {
		throw new Error('Card and collection must have PDS references (uri/cid) to create a link');
	}
	const agent = createAgent(session);
	const response = await agent.com.atproto.repo.createRecord({
		repo: session.did,
		collection: NSID.collectionLink,
		record: {
			$type: NSID.collectionLink,
			card: { uri: card.uri, cid: card.cid },
			collection: { uri: collection.uri, cid: collection.cid },
			addedBy: session.did,
			addedAt: new Date().toISOString(),
			createdAt: new Date().toISOString()
		}
	});
	return { uri: response.data.uri, cid: response.data.cid };
}

export async function deleteCollectionLinkFromPDS(
	session: OAuthSession,
	cc: CollectionCard
): Promise<void> {
	if (!cc.uri) return;
	const agent = createAgent(session);
	await agent.com.atproto.repo.deleteRecord({
		repo: session.did,
		collection: NSID.collectionLink,
		rkey: rkeyFromUri(cc.uri)
	});
}

// --- Connection operations ---

export function connectionToRecord(
	session: OAuthSession,
	connection: Connection
): Record<string, unknown> {
	return {
		$type: NSID.connection,
		source: isUrl(connection.sourceCardId)
			? connection.sourceCardId
			: cardAtUri(session.did, connection.sourceCardId),
		target: isUrl(connection.targetCardId)
			? connection.targetCardId
			: cardAtUri(session.did, connection.targetCardId),
		connectionType: connection.type,
		...(connection.note && { note: connection.note }),
		createdAt:
			connection.createdAt instanceof Date
				? connection.createdAt.toISOString()
				: connection.createdAt,
		updatedAt:
			connection.updatedAt instanceof Date
				? connection.updatedAt.toISOString()
				: connection.updatedAt
	};
}

function recordToConnection(
	uri: string,
	cid: string,
	value: Record<string, unknown>
): Connection {
	const source = value.source as string;
	const target = value.target as string;
	return {
		connectionId: rkeyFromUri(uri),
		sourceCardId: source.startsWith('at://') ? rkeyFromUri(source) : source,
		targetCardId: target.startsWith('at://') ? rkeyFromUri(target) : target,
		type: (value.connectionType as Connection['type']) || 'RELATED',
		note: value.note as string | undefined,
		createdAt: new Date(value.createdAt as string),
		updatedAt: value.updatedAt ? new Date(value.updatedAt as string) : new Date(value.createdAt as string),
		uri,
		cid
	};
}

export async function createConnectionInPDS(
	session: OAuthSession,
	connection: Connection
): Promise<{ uri: string; cid: string }> {
	const agent = createAgent(session);
	const response = await agent.com.atproto.repo.createRecord({
		repo: session.did,
		collection: NSID.connection,
		record: connectionToRecord(session, connection)
	});
	return { uri: response.data.uri, cid: response.data.cid };
}

export async function updateConnectionInPDS(
	session: OAuthSession,
	connection: Connection
): Promise<void> {
	if (!connection.uri) return;
	const agent = createAgent(session);
	await agent.com.atproto.repo.putRecord({
		repo: session.did,
		collection: NSID.connection,
		rkey: rkeyFromUri(connection.uri),
		record: connectionToRecord(session, connection)
	});
}

export async function deleteConnectionFromPDS(
	session: OAuthSession,
	connection: Connection
): Promise<void> {
	if (!connection.uri) return;
	const agent = createAgent(session);
	await agent.com.atproto.repo.deleteRecord({
		repo: session.did,
		collection: NSID.connection,
		rkey: rkeyFromUri(connection.uri)
	});
}

// --- Follow: PDS record → local ---

function recordToFollow(uri: string, cid: string, value: Record<string, unknown>): Follow {
	const subject = value.subject as string;
	return {
		followId: rkeyFromUri(uri),
		subject,
		subjectType: subject.startsWith('did:') ? 'user' : 'collection',
		createdAt: new Date(value.createdAt as string),
		uri,
		cid
	};
}

// --- Sync: pull all records from PDS into local DB ---

type PdsRecord = { uri: string; cid: string; value: Record<string, unknown> };

async function listRecordsPage(
	agent: Agent,
	repo: string,
	collection: string,
	cursor?: string
): Promise<{ records: PdsRecord[]; cursor?: string }> {
	const res = await withRetry(() =>
		agent.com.atproto.repo.listRecords({
			repo,
			collection,
			limit: 100,
			cursor
		})
	);
	return {
		records: res.data.records.map((r) => ({
			uri: r.uri,
			cid: r.cid,
			value: r.value as Record<string, unknown>
		})),
		cursor: res.data.cursor
	};
}

async function listRecordsAfter(
	agent: Agent,
	repo: string,
	collection: string,
	startCursor?: string
): Promise<PdsRecord[]> {
	const records: PdsRecord[] = [];
	let cursor = startCursor;
	while (cursor) {
		const page = await listRecordsPage(agent, repo, collection, cursor);
		records.push(...page.records);
		cursor = page.cursor;
	}
	return records;
}

async function listAllRecords(
	agent: Agent,
	repo: string,
	collection: string
): Promise<PdsRecord[]> {
	const first = await listRecordsPage(agent, repo, collection);
	const tail = await listRecordsAfter(agent, repo, collection, first.cursor);
	return [...first.records, ...tail];
}

function collectionLinkFromRecord(r: PdsRecord): CollectionCard {
	const val = r.value;
	const cardRef = val.card as Record<string, unknown>;
	const colRef = val.collection as Record<string, unknown>;
	return {
		cardId: rkeyFromUri(cardRef.uri as string),
		collectionId: rkeyFromUri(colRef.uri as string),
		addedAt: new Date(val.addedAt as string),
		uri: r.uri,
		cid: r.cid
	};
}

function followFromRecord(
	r: PdsRecord,
	metadataCache: Map<string, { displayName?: string; avatarUrl?: string }>
): Follow {
	const follow = recordToFollow(r.uri, r.cid, r.value);
	const cached = metadataCache.get(follow.followId);
	if (cached) {
		follow.displayName = cached.displayName;
		follow.avatarUrl = cached.avatarUrl;
	}
	return follow;
}

export type SyncOptions = {
	/** Called after the first page of each record type has been committed to IndexedDB. */
	onCheckpoint?: () => void;
};

export async function syncFromPDS(session: OAuthSession, opts: SyncOptions = {}): Promise<void> {
	// Guard: don't destructive-sync when there are pending offline writes
	const pendingCount = await db.writeQueue
		.where('status')
		.anyOf(['pending', 'processing', 'failed'])
		.count();
	if (pendingCount > 0) {
		if (navigator.onLine) {
			// Try to flush first — import dynamically to avoid circular deps
			const { flushQueue } = await import('./writeQueue');
			await flushQueue(session);
			const remaining = await db.writeQueue
				.where('status')
				.anyOf(['pending', 'failed'])
				.count();
			if (remaining > 0) {
				console.warn('Skipping destructive sync: pending queue entries remain');
				return;
			}
		} else {
			// Offline with pending writes — skip sync entirely
			return;
		}
	}

	const agent = createAgent(session);
	const repo = session.did;

	// Incremental sync: compare the repo's current rev against the last
	// successfully synced rev. If unchanged, skip the full scan entirely —
	// this is the common case for returning users and drops the request
	// count from O(records/100) to 1.
	let currentRev: string | undefined;
	try {
		const latest = await withRetry(() => agent.com.atproto.sync.getLatestCommit({ did: repo }));
		currentRev = latest.data.rev;
		const stored = await db.cacheMetadata.get('pds-sync');
		if (stored?.rev && stored.rev === currentRev) {
			return;
		}
	} catch (e) {
		// If the rev check fails (e.g. endpoint unavailable), fall through to
		// a full sync rather than blocking the user.
		console.warn('getLatestCommit failed, falling back to full sync:', e);
	}

	// Capture the existing follow display metadata before we clear, so we can
	// restore it for both the checkpoint and the tail.
	const existingFollows = await db.follows.toArray();
	const followMetadataCache = new Map(
		existingFollows
			.filter((f) => f.displayName)
			.map((f) => [
				f.followId,
				{ displayName: f.displayName, avatarUrl: f.avatarUrl }
			])
	);

	// Phase 1: fetch the first page of each entity type (cards, collections,
	// connections, follows) in parallel and commit. Collection links are
	// intentionally skipped here — they reference cards/collections by rkey,
	// and committing links before their parents are fully loaded would leave
	// the UI showing joins that dangle into the tail. Links are instead
	// fetched in full during phase 2, after all parents have landed.
	const [cardPage1, collectionPage1, connectionPage1, followPage1] = await Promise.all([
		listRecordsPage(agent, repo, NSID.card),
		listRecordsPage(agent, repo, NSID.collection),
		listRecordsPage(agent, repo, NSID.connection),
		listRecordsPage(agent, repo, NSID.follow)
	]);

	await db.transaction(
		'rw',
		[db.cards, db.collections, db.collectionCards, db.connections, db.follows, db.cacheMetadata],
		async () => {
			await db.cards.clear();
			await db.collections.clear();
			await db.connections.clear();
			await db.follows.clear();
			// `collectionCards` is intentionally NOT cleared here — we keep the
			// previous (stale-but-complete) join rows visible through the tail
			// phase so the user doesn't see every collection flicker to empty.
			// Phase 2 swaps them atomically once the full link set is fetched.

			if (cardPage1.records.length > 0) {
				await db.cards.bulkAdd(cardPage1.records.map((r) => recordToCard(r.uri, r.cid, r.value)));
			}
			if (collectionPage1.records.length > 0) {
				await db.collections.bulkAdd(
					collectionPage1.records.map((r) => recordToCollection(r.uri, r.cid, r.value))
				);
			}
			if (connectionPage1.records.length > 0) {
				await db.connections.bulkAdd(
					connectionPage1.records.map((r) => recordToConnection(r.uri, r.cid, r.value))
				);
			}
			if (followPage1.records.length > 0) {
				await db.follows.bulkAdd(
					followPage1.records.map((r) => followFromRecord(r, followMetadataCache))
				);
			}

			// Write a checkpoint marker so a mid-sync reload still recognizes
			// that local data exists. The `rev` is intentionally omitted until
			// the tail completes — otherwise a reload could skip the missing
			// pages and leave the user with an incomplete library.
			await db.cacheMetadata.put({ key: 'pds-sync', fetchedAt: new Date() });
		}
	);

	opts.onCheckpoint?.();

	// Phase 2: paginate the tail of each entity type, plus the full set of
	// collection links (which were skipped in phase 1). Links are committed
	// in the same transaction as the entity tails, so by the time any link
	// is visible its referenced card and collection are present.
	//
	// Concurrency is capped at 2 because the users this code path targets
	// are exactly the ones getting 429'd — fanning out 5 paginators at once
	// would re-create the pressure that `withRetry` is papering over.
	type TailTask =
		| { kind: 'card' }
		| { kind: 'collection' }
		| { kind: 'collectionLink' }
		| { kind: 'connection' }
		| { kind: 'follow' };
	const tasks: TailTask[] = [
		{ kind: 'card' },
		{ kind: 'collection' },
		{ kind: 'collectionLink' },
		{ kind: 'connection' },
		{ kind: 'follow' }
	];
	const tailResults = await parallelMap(tasks, 2, async (task) => {
		switch (task.kind) {
			case 'card':
				return { kind: task.kind, records: await listRecordsAfter(agent, repo, NSID.card, cardPage1.cursor) };
			case 'collection':
				return { kind: task.kind, records: await listRecordsAfter(agent, repo, NSID.collection, collectionPage1.cursor) };
			case 'collectionLink':
				return { kind: task.kind, records: await listAllRecords(agent, repo, NSID.collectionLink) };
			case 'connection':
				return { kind: task.kind, records: await listRecordsAfter(agent, repo, NSID.connection, connectionPage1.cursor) };
			case 'follow':
				return { kind: task.kind, records: await listRecordsAfter(agent, repo, NSID.follow, followPage1.cursor) };
		}
	});
	const byKind = Object.fromEntries(tailResults.map((r) => [r.kind, r.records])) as Record<
		TailTask['kind'],
		PdsRecord[]
	>;
	const cardTail = byKind.card;
	const collectionTail = byKind.collection;
	const collectionLinkAll = byKind.collectionLink;
	const connectionTail = byKind.connection;
	const followTail = byKind.follow;

	await db.transaction(
		'rw',
		[db.cards, db.collections, db.collectionCards, db.connections, db.follows, db.cacheMetadata],
		async () => {
			if (cardTail.length > 0) {
				await db.cards.bulkPut(cardTail.map((r) => recordToCard(r.uri, r.cid, r.value)));
			}
			if (collectionTail.length > 0) {
				await db.collections.bulkPut(
					collectionTail.map((r) => recordToCollection(r.uri, r.cid, r.value))
				);
			}
			if (connectionTail.length > 0) {
				await db.connections.bulkPut(
					connectionTail.map((r) => recordToConnection(r.uri, r.cid, r.value))
				);
			}
			if (followTail.length > 0) {
				await db.follows.bulkPut(
					followTail.map((r) => followFromRecord(r, followMetadataCache))
				);
			}
			// Atomic swap of the collection-link join table: clear the stale
			// rows carried over from the previous sync and insert the full new
			// set in the same transaction, so the UI never observes an empty
			// intermediate state.
			await db.collectionCards.clear();
			if (collectionLinkAll.length > 0) {
				await db.collectionCards.bulkAdd(collectionLinkAll.map(collectionLinkFromRecord));
			}

			await db.cacheMetadata.put({ key: 'pds-sync', fetchedAt: new Date(), rev: currentRev });
		}
	);
}

// --- Resolve PDS endpoint for a DID ---

async function resolvePdsEndpoint(did: string): Promise<string | null> {
	try {
		const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
		if (!res.ok) return null;
		const doc = await res.json();
		const services = doc.service as Array<{ id: string; type: string; serviceEndpoint: string }> | undefined;
		const pds = services?.find((s) => s.id === '#atproto_pds');
		return pds?.serviceEndpoint ?? null;
	} catch {
		return null;
	}
}

// --- Remote PDS fetch helpers ---

export async function fetchRemoteRecords(
	did: string,
	collection: string
): Promise<Array<{ uri: string; cid: string; value: Record<string, unknown> }>> {
	const pds = await resolvePdsEndpoint(did);
	if (!pds) return [];

	const records: Array<{ uri: string; cid: string; value: Record<string, unknown> }> = [];
	let cursor: string | undefined;

	do {
		const params = new URLSearchParams({
			repo: did,
			collection,
			limit: '100',
			...(cursor ? { cursor } : {})
		});
		const data = await withRetry(async () => {
			const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`);
			if (res.status === 429) {
				const err: any = new Error('Rate limited');
				err.status = 429;
				err.retryAfter = res.headers.get('retry-after') ?? undefined;
				throw err;
			}
			if (!res.ok) {
				const err: any = new Error(`listRecords failed: ${res.status}`);
				err.status = res.status;
				throw err;
			}
			return res.json();
		});
		for (const rec of data.records ?? []) {
			records.push({ uri: rec.uri, cid: rec.cid, value: rec.value });
		}
		cursor = data.cursor;
	} while (cursor);

	return records;
}

export async function fetchRemoteRecord(
	did: string,
	collection: string,
	rkey: string
): Promise<Record<string, unknown> | null> {
	const pds = await resolvePdsEndpoint(did);
	if (!pds) return null;

	const params = new URLSearchParams({ repo: did, collection, rkey });
	const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?${params}`);
	if (!res.ok) return null;
	const data = await res.json();
	return data.value as Record<string, unknown>;
}

// --- Cache helpers ---

export async function getCacheTimestamp(key: string): Promise<Date | null> {
	if (!db) return null;
	const entry = await db.cacheMetadata.get(key);
	return entry?.fetchedAt ?? null;
}

// --- Remote data caching ---

export type RemoteUserData = {
	profile: { displayName?: string; handle?: string; avatar?: string } | null;
	collections: Array<{ uri: string; name: string; description?: string }>;
};

export async function fetchRemoteUserCached(did: string): Promise<RemoteUserData | null> {
	if (!db) return null;
	const cacheKey = `remote-user:${did}`;
	const cached = await db.remoteData.where('source').equals(cacheKey).toArray();
	if (cached.length === 0) return null;
	return {
		profile: (cached.find((c) => c.type === 'profile')?.data as RemoteUserData['profile']) ?? null,
		collections: (cached.find((c) => c.type === 'collections')?.data as RemoteUserData['collections']) ?? []
	};
}

export async function fetchRemoteUserFresh(did: string): Promise<RemoteUserData> {
	const cacheKey = `remote-user:${did}`;

	const [profileRes, collectionRecords] = await Promise.all([
		fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`)
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null),
		fetchRemoteRecords(did, 'network.cosmik.collection')
	]);

	const profile = profileRes
		? { displayName: profileRes.displayName, handle: profileRes.handle, avatar: profileRes.avatar }
		: null;
	const collections = collectionRecords.map((r) => ({
		uri: r.uri,
		name: (r.value.name as string) || 'Untitled',
		description: r.value.description as string | undefined
	}));

	const now = new Date();
	await db.transaction('rw', [db.remoteData, db.cacheMetadata], async () => {
		await db.remoteData.where('source').equals(cacheKey).delete();
		await db.remoteData.bulkAdd([
			{ source: cacheKey, type: 'profile', data: profile, fetchedAt: now },
			{ source: cacheKey, type: 'collections', data: collections, fetchedAt: now }
		]);
		await db.cacheMetadata.put({ key: cacheKey, fetchedAt: now });
	});

	return { profile, collections };
}

export type RemoteCollectionData = {
	collectionName: string;
	collectionDesc?: string;
	cards: Array<Record<string, unknown>>;
};

export async function fetchRemoteCollectionCached(subject: string): Promise<RemoteCollectionData | null> {
	if (!db) return null;
	const cacheKey = `remote-collection:${subject}`;
	const cached = await db.remoteData.where('source').equals(cacheKey).toArray();
	if (cached.length === 0) return null;
	return {
		collectionName: (cached.find((c) => c.type === 'collection-meta')?.data as { name: string; description?: string })?.name ?? 'Collection',
		collectionDesc: (cached.find((c) => c.type === 'collection-meta')?.data as { name: string; description?: string })?.description,
		cards: (cached.find((c) => c.type === 'cards')?.data as Array<Record<string, unknown>>) ?? []
	};
}

export async function fetchRemoteCollectionFresh(subject: string): Promise<RemoteCollectionData> {
	const cacheKey = `remote-collection:${subject}`;
	const parts = subject.replace('at://', '').split('/');
	const repo = parts[0];
	const collection = parts.slice(1, -1).join('/');
	const rkey = parts[parts.length - 1];

	// Fetch collection metadata
	const colRecord = await fetchRemoteRecord(repo, collection, rkey);
	const collectionName = (colRecord?.name as string) || 'Collection';
	const collectionDesc = colRecord?.description as string | undefined;

	// Fetch cards via collectionLink
	let cards: Array<Record<string, unknown>> = [];
	if (collection === 'network.cosmik.collection') {
		const linkRecords = await fetchRemoteRecords(repo, 'network.cosmik.collectionLink');
		const cardRefs = linkRecords
			.filter((r) => {
				const colRef = r.value.collection as Record<string, unknown> | undefined;
				return colRef && (colRef.uri as string) === subject;
			})
			.map((r) => {
				const cardRef = r.value.card as Record<string, unknown>;
				return cardRef.uri as string;
			});

		const cardResults = await Promise.all(
			cardRefs.map(async (cardUri) => {
				const p = cardUri.replace('at://', '').split('/');
				return fetchRemoteRecord(p[0], p.slice(1, -1).join('/'), p[p.length - 1]);
			})
		);
		cards = cardResults.filter((c): c is Record<string, unknown> => c !== null);
	}

	const now = new Date();
	await db.transaction('rw', [db.remoteData, db.cacheMetadata], async () => {
		await db.remoteData.where('source').equals(cacheKey).delete();
		await db.remoteData.bulkAdd([
			{ source: cacheKey, type: 'collection-meta', data: { name: collectionName, description: collectionDesc }, fetchedAt: now },
			{ source: cacheKey, type: 'cards', data: cards, fetchedAt: now }
		]);
		await db.cacheMetadata.put({ key: cacheKey, fetchedAt: now });
	});

	return { collectionName, collectionDesc, cards };
}

// --- Resolve follow display metadata ---

export async function resolveFollowMetadata(session: OAuthSession): Promise<void> {
	const follows = await db.follows.filter((f) => !f.displayName).toArray();
	if (follows.length === 0) return;

	// Cache PDS endpoints by DID to avoid redundant lookups
	const pdsCache = new Map<string, string | null>();

	async function getPds(did: string): Promise<string | null> {
		if (!pdsCache.has(did)) {
			pdsCache.set(did, await resolvePdsEndpoint(did));
		}
		return pdsCache.get(did)!;
	}

	const resolved = await Promise.all(
		follows.map(async (follow) => {
			try {
				if (follow.subjectType === 'user') {
					const res = await fetch(
						`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(follow.subject)}`
					);
					if (res.ok) {
						const profile = await res.json();
						follow.displayName = profile.displayName || profile.handle;
						follow.avatarUrl = profile.avatar ?? undefined;
					}
				} else {
					// Collection follow — subject is an AT URI like at://did/network.cosmik.collection/rkey
					const parts = follow.subject.replace('at://', '').split('/');
					const repo = parts[0];
					const collection = parts.slice(1, -1).join('/');
					const rkey = parts[parts.length - 1];
					const pdsEndpoint = await getPds(repo);
					if (pdsEndpoint) {
						const url = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`;
						const res = await fetch(url);
						if (res.ok) {
							const data = await res.json();
							const value = data.value as Record<string, unknown>;
							follow.displayName = (value.name as string) || undefined;
						}
					}
				}
			} catch (e) {
				console.error('Failed to resolve follow metadata for', follow.subject, e);
			}
			return follow;
		})
	);

	await db.follows.bulkPut(resolved);
}
