# SembleIt

A fast, local-first client for [Semble](https://semble.so/). SembleIt gives you a lightweight interface for managing your personal Semble data — cards, collections, and connections — without the overhead of the full Semble app.

## What it does

SembleIt focuses on personal data management:

- **Cards** — Save URLs (with title, description, and image metadata) or freeform notes. Attach notes to URL cards as annotations.
- **Collections** — Organize cards into groups by topic, project, or however you like.
- **Connections** — Create directed relationships between cards with semantic types like *supports*, *opposes*, *addresses*, *leads to*, and more.
- **Following** — Browse other users' public cards and collections.

## What it doesn't do

SembleIt is intentionally scoped to personal data management. It does not include Semble features like discovery and open collections. For those, use [semble.so](https://semble.so/) directly.

## How it works

All data is stored locally in IndexedDB and synced to your AT Protocol PDS using the same `network.cosmik.*` lexicons as Semble. You sign in with your AT Protocol handle (e.g. `you.bsky.social`) via OAuth — no separate account needed.

The app is a static SPA with no server component. Your PDS is the only remote storage.

## Developing

```sh
npm install
npm run dev
```

## Building

```sh
npm run build
```

The production build is a static site (via `@sveltejs/adapter-static`) that can be deployed to any static hosting.
