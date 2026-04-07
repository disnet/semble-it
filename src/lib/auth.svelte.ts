import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { buildAtprotoLoopbackClientMetadata } from '@atproto/oauth-types';

let client: BrowserOAuthClient | null = null;
let session: OAuthSession | null = $state(null);
let loading = $state(true);
let error: string | null = $state(null);

async function getClient(): Promise<BrowserOAuthClient> {
	if (client) return client;

	const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

	if (isDev) {
		// Build a loopback client ID pointing redirect to the root path
		const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
		const redirectUri = `http://${host}:${window.location.port}/`;
		const clientMetadata = buildAtprotoLoopbackClientMetadata({
			scope: 'atproto repo:network.cosmik.card repo:network.cosmik.collection repo:network.cosmik.collectionLink repo:network.cosmik.connection',
			redirect_uris: [redirectUri]
		});

		client = new BrowserOAuthClient({
			clientMetadata,
			handleResolver: 'https://bsky.social'
		});
	} else {
		client = await BrowserOAuthClient.load({
			clientId: `${window.location.origin}/client-metadata.json`,
			handleResolver: 'https://bsky.social'
		});
	}

	return client;
}

export const auth = {
	get session() {
		return session;
	},
	get loading() {
		return loading;
	},
	get error() {
		return error;
	},
	get isLoggedIn() {
		return !!session;
	},
	get did() {
		return session?.did;
	},

	async init() {
		loading = true;
		error = null;
		try {
			const c = await getClient();
			const result = await c.init();
			if (result) {
				session = result.session;
			}
		} catch (e: any) {
			console.error('Auth init failed:', e);
			error = e?.message || 'Failed to initialize auth';
		} finally {
			loading = false;
		}
	},

	async login(handle: string) {
		error = null;
		try {
			const c = await getClient();
			await c.signIn(handle, {
				state: 'login',
				scope: 'atproto repo:network.cosmik.card repo:network.cosmik.collection repo:network.cosmik.collectionLink repo:network.cosmik.connection'
			});
			// signIn redirects — this line is not reached
		} catch (e: any) {
			error = e?.message || 'Login failed';
			throw e;
		}
	},

	async logout() {
		try {
			if (session) {
				await session.signOut();
			}
		} catch {
			// ignore signOut errors
		}
		session = null;
	}
};
