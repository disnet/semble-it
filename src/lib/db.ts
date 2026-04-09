import Dexie, { type Table } from 'dexie';
import type { Card, Collection, CollectionCard, Connection, Follow, CacheMetadata, RemoteDataCache } from './types';

export interface WriteQueueEntry {
	id?: number;
	createdAt: Date;
	operation: 'create' | 'put' | 'delete';
	collection: string;
	rkey: string;
	record?: Record<string, unknown>;
	localTable: string;
	localId: string;
	status: 'pending' | 'processing' | 'failed' | 'dead';
	attempts: number;
	lastError?: string;
	lastAttemptAt?: Date;
}

class SembleItDB extends Dexie {
	cards!: Table<Card>;
	collections!: Table<Collection>;
	collectionCards!: Table<CollectionCard>;
	connections!: Table<Connection>;
	follows!: Table<Follow>;
	cacheMetadata!: Table<CacheMetadata>;
	remoteData!: Table<RemoteDataCache>;
	writeQueue!: Table<WriteQueueEntry>;

	constructor(did: string) {
		super(`sembleit-${did}`);
		this.version(1).stores({
			cards: 'cardId, type, url, parentCardId, createdAt, updatedAt, uri',
			collections: 'collectionId, name, createdAt, uri',
			collectionCards: '[collectionId+cardId], collectionId, cardId, addedAt, uri',
			connections: 'connectionId, sourceCardId, targetCardId, type, createdAt, uri',
			follows: 'followId, subject, subjectType, createdAt, uri',
			cacheMetadata: 'key',
			remoteData: '[source+type], source, type'
		});
		this.version(2).stores({
			writeQueue: '++id, createdAt, status, collection, rkey'
		});
	}
}

export let db: SembleItDB;

export function openDb(did: string) {
	if (db) db.close();
	db = new SembleItDB(did);
}

export function closeDb() {
	if (db) {
		db.close();
	}
}
