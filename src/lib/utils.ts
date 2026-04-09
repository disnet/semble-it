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

export function timeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
