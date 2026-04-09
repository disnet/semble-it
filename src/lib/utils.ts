import type { Card } from './types';

export function isUrl(value: string): boolean {
	return value.startsWith('http://') || value.startsWith('https://');
}

export function formatDate(date: Date, style: 'short' | 'long' = 'long'): string {
	const options: Intl.DateTimeFormatOptions =
		style === 'short'
			? { month: 'short', day: 'numeric' }
			: { year: 'numeric', month: 'short', day: 'numeric' };
	return new Date(date).toLocaleDateString(undefined, options);
}

export function getCardLabel(card: Card): string {
	if (card.type === 'URL') return card.title || card.url;
	return card.text.slice(0, 80);
}
