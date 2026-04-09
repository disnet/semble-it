import Dexie, { type Table } from 'dexie';
import type { Card, Collection, CollectionCard, Connection, Follow, CacheMetadata, RemoteDataCache } from './types';

class SembleItDB extends Dexie {
	cards!: Table<Card>;
	collections!: Table<Collection>;
	collectionCards!: Table<CollectionCard>;
	connections!: Table<Connection>;
	follows!: Table<Follow>;
	cacheMetadata!: Table<CacheMetadata>;
	remoteData!: Table<RemoteDataCache>;

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
