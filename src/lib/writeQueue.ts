import type { OAuthSession } from '@atproto/oauth-client-browser';
import { db, type WriteQueueEntry } from './db';
import { createAgent, NSID, BASE_NSID, cardToRecord, collectionToRecord, connectionToRecord, rkeyFromUri, cardAtUri } from './pds';
import { handleExpiredAuth } from './pds';
import { network } from './network.svelte';
import type { Card, Collection, CollectionCard, Connection } from './types';
import { auth } from './auth.svelte';
import { isUrl } from './utils';

const MAX_ATTEMPTS = 10;

// --- Queue internals ---

async function enqueue(
	entry: Omit<WriteQueueEntry, 'id' | 'status' | 'attempts'>
): Promise<void> {
	// Coalesce with any existing pending/failed entry for the same record
	if (entry.operation === 'put' || entry.operation === 'create') {
		const existing = await db.writeQueue
			.where('rkey')
			.equals(entry.rkey)
			.filter((e) => e.collection === entry.collection && (e.status === 'pending' || e.status === 'failed'))
			.first();
		if (existing) {
			await db.writeQueue.update(existing.id!, {
				record: entry.record,
				status: 'pending',
				attempts: 0,
				lastError: undefined,
				lastAttemptAt: undefined
			});
			return;
		}
	}
	await db.writeQueue.add({
		...entry,
		status: 'pending',
		attempts: 0
	});
}

function isNetworkError(e: unknown): boolean {
	if (e instanceof TypeError && String(e.message).includes('fetch')) return true;
	const name = (e as any)?.name;
	if (name === 'NetworkError' || name === 'AbortError') return true;
	return !navigator.onLine;
}

// --- Flush queue ---

let flushing = false;

export async function flushQueue(session: OAuthSession): Promise<void> {
	if (flushing) return;
	flushing = true;
	try {
		const agent = createAgent(session);
		const entries = await db.writeQueue
			.where('status')
			.anyOf(['pending', 'failed'])
			.sortBy('createdAt');

		for (const entry of entries) {
			// Skip permanently failed entries
			if (entry.attempts >= MAX_ATTEMPTS) {
				await db.writeQueue.update(entry.id!, { status: 'dead' });
				continue;
			}

			// Exponential backoff for failed entries
			if (entry.status === 'failed' && entry.lastAttemptAt) {
				const backoffMs = Math.min(1000 * 2 ** entry.attempts, 5 * 60 * 1000);
				if (Date.now() - entry.lastAttemptAt.getTime() < backoffMs) continue;
			}

			await db.writeQueue.update(entry.id!, { status: 'processing' });

			try {
				let record = entry.record;

				// For collectionLink creates, rebuild record at flush time to get current uri/cid
				if (entry.operation === 'create' && entry.collection === NSID.collectionLink && record) {
					const cardId = record._cardId as string;
					const collectionId = record._collectionId as string;
					const card = await db.cards.get(cardId);
					const col = await db.collections.get(collectionId);
					if (!card?.uri || !card?.cid || !col?.uri || !col?.cid) {
						// Dependencies not yet synced — skip for now
						await db.writeQueue.update(entry.id!, { status: 'pending' });
						continue;
					}
					record = {
						$type: NSID.collectionLink,
						card: { uri: card.uri, cid: card.cid },
						collection: { uri: col.uri, cid: col.cid },
						addedBy: session.did,
						addedAt: record._addedAt as string,
						createdAt: record._addedAt as string
					};
				}

				// For connection creates/puts, rebuild to get current card URIs
				if ((entry.operation === 'create' || entry.operation === 'put') && entry.collection === NSID.connection) {
					const conn = await db.connections.get(entry.localId);
					if (conn) {
						record = connectionToRecord(session, conn);
					} else {
						// Local record was deleted — discard this queue entry
						await db.writeQueue.delete(entry.id!);
						continue;
					}
				}

				if (entry.operation === 'create') {
					const response = await agent.com.atproto.repo.createRecord({
						repo: session.did,
						collection: entry.collection,
						rkey: entry.rkey,
						record: record!
					});
					// Update local record with uri/cid
					const uri = response.data.uri;
					const cid = response.data.cid;
					await updateLocalRecord(entry, uri, cid);
				} else if (entry.operation === 'put') {
					await agent.com.atproto.repo.putRecord({
						repo: session.did,
						collection: entry.collection,
						rkey: entry.rkey,
						record: record!
					});
				} else if (entry.operation === 'delete') {
					await agent.com.atproto.repo.deleteRecord({
						repo: session.did,
						collection: entry.collection,
						rkey: entry.rkey
					});
				}

				await db.writeQueue.delete(entry.id!);
			} catch (e) {
				if (await handleExpiredAuth(e)) return;
				if (isNetworkError(e)) {
					await db.writeQueue.update(entry.id!, { status: 'pending' });
					return; // Stop processing — offline
				}
				await db.writeQueue.update(entry.id!, {
					status: 'failed',
					attempts: entry.attempts + 1,
					lastError: String((e as any)?.message ?? e),
					lastAttemptAt: new Date()
				});
			}
		}
	} finally {
		flushing = false;
	}
}

async function updateLocalRecord(entry: WriteQueueEntry, uri: string, cid: string): Promise<void> {
	switch (entry.localTable) {
		case 'cards':
			await db.cards.update(entry.localId, { uri, cid });
			break;
		case 'collections':
			await db.collections.update(entry.localId, { uri, cid });
			break;
		case 'collectionCards': {
			// localId is "collectionId:cardId"
			const [colId, cardId] = entry.localId.split(':');
			await db.collectionCards
				.where('[collectionId+cardId]')
				.equals([colId, cardId])
				.modify({ uri, cid });
			break;
		}
		case 'connections':
			await db.connections.update(entry.localId, { uri, cid });
			break;
	}
}

function tryFlush(): void {
	if (network.online && auth.session) {
		flushQueue(auth.session).catch(console.error);
	}
}

// --- Card wrappers ---

export async function queueCreateCard(
	card: Card,
	parentRef?: { uri: string; cid: string }
): Promise<void> {
	await db.cards.add(card);
	await enqueue({
		createdAt: new Date(),
		operation: 'create',
		collection: NSID.card,
		rkey: card.cardId,
		record: cardToRecord(card, parentRef),
		localTable: 'cards',
		localId: card.cardId
	});
	tryFlush();
}

export async function queueUpdateCard(card: Card): Promise<void> {
	await db.cards.put(card);
	await enqueue({
		createdAt: new Date(),
		operation: 'put',
		collection: NSID.card,
		rkey: card.cardId,
		record: cardToRecord(card),
		localTable: 'cards',
		localId: card.cardId
	});
	tryFlush();
}

export async function queueDeleteCard(card: Card): Promise<void> {
	// Gather related records before deleting
	const [ccLinks, srcConns, tgtConns] = await Promise.all([
		db.collectionCards.where('cardId').equals(card.cardId).toArray(),
		db.connections.where('sourceCardId').equals(card.cardId).toArray(),
		db.connections.where('targetCardId').equals(card.cardId).toArray()
	]);

	// Delete locally in a transaction
	await db.transaction('rw', [db.cards, db.collectionCards, db.connections, db.writeQueue], async () => {
		await db.cards.delete(card.cardId);
		await db.collectionCards.where('cardId').equals(card.cardId).delete();
		await db.connections.where('sourceCardId').equals(card.cardId).delete();
		await db.connections.where('targetCardId').equals(card.cardId).delete();

		// Remove any pending queue entries for this card and related records
		await db.writeQueue.where('rkey').equals(card.cardId).delete();
		for (const cc of ccLinks) {
			if (cc.uri) {
				const rkey = rkeyFromUri(cc.uri);
				await db.writeQueue.where('rkey').equals(rkey).delete();
			}
		}
		for (const conn of [...srcConns, ...tgtConns]) {
			await db.writeQueue.where('rkey').equals(conn.connectionId).delete();
		}
	});

	// Enqueue PDS deletes for records that had URIs (existed on PDS)
	if (card.uri) {
		await enqueue({
			createdAt: new Date(),
			operation: 'delete',
			collection: NSID.card,
			rkey: rkeyFromUri(card.uri),
			localTable: 'cards',
			localId: card.cardId
		});
	}
	for (const cc of ccLinks) {
		if (cc.uri) {
			await enqueue({
				createdAt: new Date(),
				operation: 'delete',
				collection: NSID.collectionLink,
				rkey: rkeyFromUri(cc.uri),
				localTable: 'collectionCards',
				localId: `${cc.collectionId}:${cc.cardId}`
			});
		}
	}
	for (const conn of [...srcConns, ...tgtConns]) {
		if (conn.uri) {
			await enqueue({
				createdAt: new Date(),
				operation: 'delete',
				collection: NSID.connection,
				rkey: rkeyFromUri(conn.uri),
				localTable: 'connections',
				localId: conn.connectionId
			});
		}
	}
	tryFlush();
}

// --- Collection wrappers ---

export async function queueCreateCollection(collection: Collection): Promise<void> {
	await db.collections.add(collection);
	await enqueue({
		createdAt: new Date(),
		operation: 'create',
		collection: NSID.collection,
		rkey: collection.collectionId,
		record: collectionToRecord(collection),
		localTable: 'collections',
		localId: collection.collectionId
	});
	tryFlush();
}

export async function queueUpdateCollection(collection: Collection): Promise<void> {
	await db.collections.put(collection);
	await enqueue({
		createdAt: new Date(),
		operation: 'put',
		collection: NSID.collection,
		rkey: collection.collectionId,
		record: collectionToRecord(collection),
		localTable: 'collections',
		localId: collection.collectionId
	});
	tryFlush();
}

export async function queueDeleteCollection(collection: Collection): Promise<void> {
	const ccLinks = await db.collectionCards
		.where('collectionId')
		.equals(collection.collectionId)
		.toArray();

	await db.transaction('rw', [db.collections, db.collectionCards, db.writeQueue], async () => {
		await db.collections.delete(collection.collectionId);
		await db.collectionCards.where('collectionId').equals(collection.collectionId).delete();
		await db.writeQueue.where('rkey').equals(collection.collectionId).delete();
		for (const cc of ccLinks) {
			if (cc.uri) {
				await db.writeQueue.where('rkey').equals(rkeyFromUri(cc.uri)).delete();
			}
		}
	});

	if (collection.uri) {
		await enqueue({
			createdAt: new Date(),
			operation: 'delete',
			collection: NSID.collection,
			rkey: rkeyFromUri(collection.uri),
			localTable: 'collections',
			localId: collection.collectionId
		});
	}
	for (const cc of ccLinks) {
		if (cc.uri) {
			await enqueue({
				createdAt: new Date(),
				operation: 'delete',
				collection: NSID.collectionLink,
				rkey: rkeyFromUri(cc.uri),
				localTable: 'collectionCards',
				localId: `${cc.collectionId}:${cc.cardId}`
			});
		}
	}
	tryFlush();
}

// --- CollectionLink wrappers ---

export async function queueCreateCollectionLink(
	cardId: string,
	collectionId: string
): Promise<void> {
	const cc: CollectionCard = {
		collectionId,
		cardId,
		addedAt: new Date()
	};
	await db.collectionCards.add(cc);
	await enqueue({
		createdAt: new Date(),
		operation: 'create',
		collection: NSID.collectionLink,
		rkey: crypto.randomUUID(),
		// Store local IDs — record will be rebuilt at flush time
		record: {
			_cardId: cardId,
			_collectionId: collectionId,
			_addedAt: cc.addedAt.toISOString()
		},
		localTable: 'collectionCards',
		localId: `${collectionId}:${cardId}`
	});
	tryFlush();
}

export async function queueDeleteCollectionLink(cc: CollectionCard): Promise<void> {
	await db.collectionCards
		.where('[collectionId+cardId]')
		.equals([cc.collectionId, cc.cardId])
		.delete();

	if (cc.uri) {
		// Remove any pending creates for this link
		const rkey = rkeyFromUri(cc.uri);
		await db.writeQueue.where('rkey').equals(rkey).delete();
		await enqueue({
			createdAt: new Date(),
			operation: 'delete',
			collection: NSID.collectionLink,
			rkey,
			localTable: 'collectionCards',
			localId: `${cc.collectionId}:${cc.cardId}`
		});
	} else {
		// Never synced — just remove any pending queue entries
		// Find by localId pattern
		const pending = await db.writeQueue
			.where('collection')
			.equals(NSID.collectionLink)
			.filter((e) => e.localId === `${cc.collectionId}:${cc.cardId}`)
			.toArray();
		for (const p of pending) {
			await db.writeQueue.delete(p.id!);
		}
	}
	tryFlush();
}

// --- Connection wrappers ---

export async function queueCreateConnection(connection: Connection): Promise<void> {
	await db.connections.add(connection);
	// Record will be rebuilt at flush time using connectionToRecord
	await enqueue({
		createdAt: new Date(),
		operation: 'create',
		collection: NSID.connection,
		rkey: connection.connectionId,
		record: {}, // placeholder — rebuilt at flush
		localTable: 'connections',
		localId: connection.connectionId
	});
	tryFlush();
}

export async function queueUpdateConnection(connection: Connection): Promise<void> {
	await db.connections.put(connection);
	await enqueue({
		createdAt: new Date(),
		operation: 'put',
		collection: NSID.connection,
		rkey: connection.connectionId,
		record: {}, // placeholder — rebuilt at flush
		localTable: 'connections',
		localId: connection.connectionId
	});
	tryFlush();
}

export async function queueDeleteConnection(connection: Connection): Promise<void> {
	await db.connections.delete(connection.connectionId);
	await db.writeQueue.where('rkey').equals(connection.connectionId).delete();

	if (connection.uri) {
		await enqueue({
			createdAt: new Date(),
			operation: 'delete',
			collection: NSID.connection,
			rkey: rkeyFromUri(connection.uri),
			localTable: 'connections',
			localId: connection.connectionId
		});
	}
	tryFlush();
}
