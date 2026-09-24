# Cloudflare search worker

This Worker is the Cloudflare-native migration of the SyncPundit SearXNG deployment. It retains the fixed outbound compatibility probes and exposes authenticated SearXNG-compatible search paths backed by DuckDuckGo HTML, Google CSE, Brave HTML, and the Brave Search API. A configured Serper adapter retains the divergence branch's conditional Google fallback.

## Routes

- `GET /` opens the familiar SearXNG Simple search and results UI. Cloudflare serves the upstream built theme assets directly.
- `GET /healthz` returns Worker health.
- `GET /compat` lists the fixed compatibility probes.
- `POST /compat/run` runs selected probes. This route requires `SPIKE_AUTH_TOKEN` as a bearer token.
- `GET /search?q=...&pageno=1` renders browser-facing HTML without a bearer token. DuckDuckGo, Google CSE, and a configured Brave API adapter run concurrently, then their results are deduplicated and scored. Set `engines=duckduckgo`, `engines=google cse`, `engines=brave`, or `engines=braveapi` to choose one engine. A comma-separated list selects several engines.
- `GET /search?q=...&format=json&pageno=1` returns the same result model as JSON and requires `SPIKE_AUTH_TOKEN` as a bearer token. This is the machine-facing endpoint for Threat Hunter.

The probes return status, timing, content type, sampled byte count, and a SHA-256 digest. They do not return or store upstream response content.

The search route accepts the query, positive page number, and implemented engine choices used by Threat Hunter. When `engines` is omitted, DuckDuckGo and Google CSE run with Brave API when its server-side key is configured. Brave HTML remains a separate, explicitly selectable engine. The Worker owns the upstream URL, request method, and headers.

Results retain the SearXNG JSON fields consumed by Threat Hunter. Matching URLs from several engines are merged with their engine provenance and positions, then scored using SearXNG's position-based formula. A failed provider is listed in `unresponsive_engines`. The request still succeeds when another selected provider completed, including a valid empty result set. It fails only when every selected provider is unavailable.

When `SERPER_API_KEY` is configured, Serper runs only if every queried Google primary returned no results. It uses 10 results per request so dork queries remain compatible with Serper's retained account constraint. `SERPER_PRIMARY_ENGINES` defaults to `google,google cse`, and `SERPER_MAX_PAGE` defaults to `5`. A Serper failure does not replace or fail results returned by another engine.

## Access boundary

The `workers.dev` hostname and browser HTML search are public. Browser users do not receive, enter, store, or send `SPIKE_AUTH_TOKEN`. The token gates machine-readable JSON results and compatibility-probe execution so only authorized clients can consume those interfaces.

Threat Hunter must request `format=json` and send `Authorization: Bearer <SPIKE_AUTH_TOKEN>`. A future Worker service binding can keep the same application-level bearer contract unless the trust boundary is deliberately changed.

## Live deployment

The Worker runs at `https://searxng.pundit.workers.dev/` on the paid Workers plan. Cloudflare Workers Builds deploys every push to `cloudflare-deploy`; do not deploy this Worker from a developer machine.

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

Add `SPIKE_AUTH_TOKEN`, `BRAVE_API_KEY`, and `SERPER_API_KEY` as runtime secrets. `BRAVE_API_KEY` and `SERPER_API_KEY` are optional; their adapters remain inactive when the matching secret is absent. Future pushes to `cloudflare-deploy` preserve the secrets and deploy the new Worker version.

## Add a probe

Add a fixed probe to `PROBES` in `src/index.js`. Do not accept a caller-supplied URL, request body, header, or search query. Add tests for both the valid probe and rejected caller-controlled input.
