# Cloudflare compatibility worker

This Worker is the migration path from SearXNG to a Cloudflare-native search service. It retains the fixed outbound compatibility probes and exposes authenticated SearXNG-compatible search paths backed by DuckDuckGo HTML, Brave HTML, and the Brave Search API.

## Routes

- `GET /` opens the familiar SearXNG Simple search and results UI. Cloudflare serves the upstream built theme assets directly, while a thin browser controller calls the provider-neutral JSON contract. The bearer token stays in tab-scoped session storage.
- `GET /healthz` returns Worker health.
- `GET /compat` lists the fixed compatibility probes.
- `POST /compat/run` runs selected probes. This route requires `SPIKE_AUTH_TOKEN` as a bearer token.
- `GET /search?q=...&format=json&pageno=1&engines=duckduckgo` runs a DuckDuckGo HTML search. Set `engines=brave` to parse Brave Search HTML or `engines=braveapi` to use the Brave Search API. This route requires `SPIKE_AUTH_TOKEN` as a bearer token.

The probes return status, timing, content type, sampled byte count, and a SHA-256 digest. They do not return or store upstream response content.

The search route accepts the query, positive page number, and implemented engine choice used by Threat Hunter. DuckDuckGo remains the default when the engine is omitted. The Worker owns the upstream URL, request method, and headers. Results retain the SearXNG JSON fields consumed by Threat Hunter, including engine provenance and rank score. A provider failure returns HTTP 502 instead of looking like a valid empty result set.

## Access boundary

The `workers.dev` hostname is public. `SPIKE_AUTH_TOKEN` prevents anonymous callers from consuming search-provider quota during compatibility testing. The token field in the browser is an acceptance tool, not the planned production credential flow.

When Threat Hunter moves to Cloudflare, it should call this Worker through a Worker service binding. That internal call does not need the browser token field. Keep the public `/search` route authenticated or disable it when the service binding becomes the production path.

## Live deployment

The compatibility Worker runs at `https://searxng.pundit-workers.workers.dev/`. Cloudflare Workers Builds deploys every push to `cloudflare-deploy`; do not deploy this Worker from a developer machine.

## Run locally

Install dependencies and run the checks:

```sh
npm ci
npm test
npm run check
```

Start the Worker:

```sh
npm run dev
```

Set `SPIKE_AUTH_TOKEN` in `.dev.vars` to run probes locally. Do not commit `.dev.vars`.

## Configure Workers Builds

Connect `Sync-Pundit/SearXNG` to the `searxng` Worker with these settings:

- Production branch: `cloudflare-deploy`
- Root directory: `/cloudflare`
- Build command: `npm ci && npm test && npm run check`
- Deploy command: `npm run deploy`
- Non-production branch builds: disabled

Cloudflare owns the dedicated `searxng build token`. Do not copy a local Wrangler OAuth token into GitHub.

Add `SPIKE_AUTH_TOKEN` and `BRAVE_API_KEY` as runtime secrets. Future pushes to `cloudflare-deploy` preserve the secrets and deploy the new Worker version.

## Add a probe

Add a fixed probe to `PROBES` in `src/index.js`. Do not accept a caller-supplied URL, request body, header, or search query. Add tests for both the valid probe and rejected caller-controlled input.
