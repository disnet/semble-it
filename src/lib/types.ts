export type CardType = 'URL' | 'NOTE';

export interface CardBase {
	cardId: string;
	type: CardType;
	createdAt: Date;
	updatedAt: Date;
	parentCardId?: string;
	// PDS references
	uri?: string;
	cid?: string;
}

export interface UrlCard extends CardBase {
	type: 'URL';
	url: string;
	title?: string;
	description?: string;
	imageUrl?: string;
}

export interface NoteCard extends CardBase {
	type: 'NOTE';
	text: string;
	parentCardId?: string;
}

export type Card = UrlCard | NoteCard;

export interface Collection {
	collectionId: string;
	name: string;
	description?: string;
	createdAt: Date;
	updatedAt: Date;
	// PDS references
	uri?: string;
	cid?: string;
}

export interface CollectionCard {
	collectionId: string;
	cardId: string;
	addedAt: Date;
	// PDS references
	uri?: string;
	cid?: string;
}

export const CONNECTION_TYPES = [
	'SUPPORTS',
	'OPPOSES',
	'ADDRESSES',
	'HELPFUL',
	'LEADS_TO',
	'RELATED',
	'SUPPLEMENT',
	'EXPLAINER'
] as const;

export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export interface Connection {
	connectionId: string;
	sourceCardId: string;
	targetCardId: string;
	type: ConnectionType;
	note?: string;
	createdAt: Date;
	updatedAt: Date;
	// PDS references
	uri?: string;
	cid?: string;
}
