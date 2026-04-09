import Dexie, { type Table } from 'dexie';
import type { Card, Collection, CollectionCard, Connection, Follow } from './types';

class AssembleDB extends Dexie {
	cards!: Table<Card>;
	collections!: Table<Collection>;
	collectionCards!: Table<CollectionCard>;
	connections!: Table<Connection>;
	follows!: Table<Follow>;

	constructor() {
		super('assemble');
		this.version(1).stores({
			cards: 'cardId, type, url, parentCardId, createdAt, updatedAt',
			collections: 'collectionId, name, createdAt',
			collectionCards: '[collectionId+cardId], collectionId, cardId, addedAt',
			connections: 'connectionId, sourceCardId, targetCardId, type, createdAt'
		});
		this.version(2).stores({
			cards: 'cardId, type, url, parentCardId, createdAt, updatedAt, uri',
			collections: 'collectionId, name, createdAt, uri',
			collectionCards: '[collectionId+cardId], collectionId, cardId, addedAt, uri',
			connections: 'connectionId, sourceCardId, targetCardId, type, createdAt, uri'
		});
		this.version(3).stores({
			cards: 'cardId, type, url, parentCardId, createdAt, updatedAt, uri',
			collections: 'collectionId, name, createdAt, uri',
			collectionCards: '[collectionId+cardId], collectionId, cardId, addedAt, uri',
			connections: 'connectionId, sourceCardId, targetCardId, type, createdAt, uri',
			follows: 'followId, subject, subjectType, createdAt, uri'
		});
	}
}

export const db = new AssembleDB();
