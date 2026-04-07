import { Agent } from '@atproto/api';
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { db } from './db';
import type { Card, Collection, CollectionCard, Connection } from './types';

const BASE_NSID = 'network.cosmik';
const NSID = {
	card: `${BASE_NSID}.card`,
	collection: `${BASE_NSID}.collection`,
	collectionLink: `${BASE_NSID}.collectionLink`,
	connection: `${BASE_NSID}.connection`
} as const;

function createAgent(session: OAuthSession): Agent {
	return new Agent(session);
}

function rkeyFromUri(uri: string): string {
	return uri.split('/').pop()!;
}

function cardAtUri(did: string, rkey: string): string {
	return `at://${did}/${NSID.card}/${rkey}`;
}

function collectionAtUri(did: string, rkey: string): string {
	return `at://${did}/${NSID.collection}/${rkey}`;
}

// --- Card: local → PDS record ---

function cardToRecord(card: Card): Record<string, unknown> {
	const record: Record<string, unknown> = {
		$type: NSID.card,
		type: card.type === 'HIGHLIGHT' ? 'NOTE' : card.type,
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
	} else if (card.type === 'HIGHLIGHT') {
		// Map highlights to NOTE cards with the highlighted text
		record.content = {
			$type: `${BASE_NSID}.card#noteContent`,
			text: card.text
		};
		if (card.sourceUrl) {
			record.url = card.sourceUrl;
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
			title: metadata?.title as string | undefined,
			description: metadata?.description as string | undefined
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
	card: Card
): Promise<{ uri: string; cid: string }> {
	const agent = createAgent(session);
	const response = await agent.com.atproto.repo.createRecord({
		repo: session.did,
		collection: NSID.card,
		record: cardToRecord(card)
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

function collectionToRecord(collection: Collection): Record<string, unknown> {
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

function isUrl(value: string): boolean {
	return value.startsWith('http://') || value.startsWith('https://');
}

function connectionToRecord(
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
	const agent = createAgent(session);
	const repo = session.did;

	const [cardRecords, collectionRecords, collectionLinkRecords, connectionRecords] =
		await Promise.all([
			listAllRecords(agent, repo, NSID.card),
			listAllRecords(agent, repo, NSID.collection),
			listAllRecords(agent, repo, NSID.collectionLink),
			listAllRecords(agent, repo, NSID.connection)
		]);

	await db.transaction(
		'rw',
		[db.cards, db.collections, db.collectionCards, db.connections],
		async () => {
			await db.cards.clear();
			await db.collections.clear();
			await db.collectionCards.clear();
			await db.connections.clear();

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
		}
	);
}
