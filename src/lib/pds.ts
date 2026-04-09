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

async function listAllRecords(
	agent: Agent,
	repo: string,
	collection: string
): Promise<Array<{ uri: string; cid: string; value: Record<string, unknown> }>> {
	const records: Array<{ uri: string; cid: string; value: Record<string, unknown> }> = [];
	let cursor: string | undefined;

	do {
		const res = await agent.com.atproto.repo.listRecords({
			repo,
			collection,
			limit: 100,
			cursor
		});
		for (const rec of res.data.records) {
			records.push({ uri: rec.uri, cid: rec.cid, value: rec.value as Record<string, unknown> });
		}
		cursor = res.data.cursor;
	} while (cursor);

	return records;
}

export async function syncFromPDS(session: OAuthSession): Promise<void> {
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

	const [cardRecords, collectionRecords, collectionLinkRecords, connectionRecords, followRecords] =
		await Promise.all([
			listAllRecords(agent, repo, NSID.card),
			listAllRecords(agent, repo, NSID.collection),
			listAllRecords(agent, repo, NSID.collectionLink),
			listAllRecords(agent, repo, NSID.connection),
			listAllRecords(agent, repo, NSID.follow)
		]);

	await db.transaction(
		'rw',
		[db.cards, db.collections, db.collectionCards, db.connections, db.follows, db.cacheMetadata],
		async () => {
			await db.cards.clear();
			await db.collections.clear();
			await db.collectionCards.clear();
			await db.connections.clear();
			await db.follows.clear();

			if (cardRecords.length > 0) {
				await db.cards.bulkAdd(
					cardRecords.map((r) => recordToCard(r.uri, r.cid, r.value))
				);
			}

			if (collectionRecords.length > 0) {
				await db.collections.bulkAdd(
					collectionRecords.map((r) => recordToCollection(r.uri, r.cid, r.value))
				);
			}

			if (collectionLinkRecords.length > 0) {
				await db.collectionCards.bulkAdd(
					collectionLinkRecords.map((r) => {
						const val = r.value;
						const cardRef = val.card as Record<string, unknown>;
						const colRef = val.collection as Record<string, unknown>;
						return {
							cardId: rkeyFromUri(cardRef.uri as string),
							collectionId: rkeyFromUri(colRef.uri as string),
							addedAt: new Date(val.addedAt as string),
							uri: r.uri,
							cid: r.cid
						} satisfies CollectionCard;
					})
				);
			}

			if (connectionRecords.length > 0) {
				await db.connections.bulkAdd(
					connectionRecords.map((r) => recordToConnection(r.uri, r.cid, r.value))
				);
			}

			if (followRecords.length > 0) {
				// Preserve cached display metadata from previous sync
				const existingFollows = await db.follows.toArray();
				const metadataCache = new Map(
					existingFollows
						.filter((f) => f.displayName)
						.map((f) => [f.followId, { displayName: f.displayName, avatarUrl: f.avatarUrl }])
				);
				await db.follows.clear();
				await db.follows.bulkAdd(
					followRecords.map((r) => {
						const follow = recordToFollow(r.uri, r.cid, r.value);
						const cached = metadataCache.get(follow.followId);
						if (cached) {
							follow.displayName = cached.displayName;
							follow.avatarUrl = cached.avatarUrl;
						}
						return follow;
					})
				);
			}

			await db.cacheMetadata.put({ key: 'pds-sync', fetchedAt: new Date() });
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
		const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`);
		if (!res.ok) break;
		const data = await res.json();
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
