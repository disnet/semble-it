/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Skip non-local requests
	if (url.origin !== self.location.origin) return;

	// Navigation requests (HTML pages): network-first so updates are seen immediately
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					if (response.status === 200) {
						const clone = response.clone();
						caches.open(CACHE).then((cache) => cache.put(event.request, clone));
					}
					return response;
				})
				.catch(() => caches.match(event.request).then((cached) => cached ?? Response.error()))
		);
		return;
	}

	// Static assets: cache-first
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;
			return fetch(event.request).then((response) => {
				if (response.status === 200) {
					const clone = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, clone));
				}
				return response;
			});
		})
	);
});
