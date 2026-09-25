# Cloudflare SearXNG

This directory deploys the retained SearXNG application as a Cloudflare-native
hybrid:

- Workers Static Assets serves the upstream Simple theme directly from
  Cloudflare's asset network.
- An edge Worker owns the public/machine boundary, health response, forwarding
  headers, and timing evidence.
- A Cloudflare Container runs this repository's Python SearXNG application.

The Container preserves the complete upstream interface and engine ecosystem.
The Worker stays deliberately small; it does not reimplement search providers,
preferences, ranking, result templates, or plugins.

## Request boundary

Browser routes such as `/`, `/search`, `/preferences`, `/stats`, and the info
pages are public. A browser never receives or enters a Worker token.

Machine search is the same SearXNG endpoint with either `format=json` or an
`Accept: application/json` header. It requires:

```text
Authorization: Bearer <SEARXNG_AUTH_TOKEN>
```

The Worker strips that header before forwarding the request. `POST /search` is
rejected because the edge gate cannot safely classify a format hidden in a
form body; the SearXNG method preference is therefore locked to `GET`.
Client-supplied forwarding headers are also discarded. The private Container
receives `X-Real-IP` only from Cloudflare's `CF-Connecting-IP` header.

`GET /healthz` is answered at the edge and does not wake the Container.

## Runtime

The `SearxngContainer` Durable Object owns one named `basic` Container and does
not impose a region constraint. Cloudflare selects its location. The Worker and
static assets remain edge-distributed, but this single Container is not cloned
into every user's nearest region. It stays warm for 24 hours after traffic to
avoid repeated cold starts during normal use. Cloudflare may still restart or
reschedule it, so the Worker returns a retryable `503` with `Retry-After: 2`
while the process starts.

Container secrets are passed as environment variables:

- `BRAVE_API_KEY` enables the separate `braveapi` engine.
- `SERPER_API_KEY` enables the conditional Serper fallback.
- `SEARXNG_SECRET` signs SearXNG preferences.

`brave` remains the HTML engine and `braveapi` remains the official API engine.
They are separate, independently selectable engines and both are enabled in
the default general search. They must not be renamed or merged.

## Static delivery

`npm run assets` copies the built upstream Simple theme into `.assets`. The
directory is uploaded with the Worker but is not committed.

Static paths are asset-first: they do not run Worker or Container code. The
browser may cache `/static/*` for one hour and serve stale assets while
Cloudflare revalidates them for one day. Dynamic HTML remains owned by SearXNG.

This removes the previous latency defect where `run_worker_first: true` sent
every CSS, JavaScript, font, and image request through application code and the
responses then forced revalidation.

## Local verification

```sh
cd cloudflare
npm ci
npm test
npm run check
npm run dev
```

The `precheck`, `predeploy`, and `predev` hooks rebuild `.assets`. Do not edit or
commit `.assets`.

Container acceptance additionally verifies the real Python application:

```sh
docker build -f cloudflare/container.Dockerfile -t searxng-cloudflare .
docker run --rm -p 127.0.0.1:18080:8080 searxng-cloudflare
```

Then check `/`, `/preferences`, browser `/search`, and JSON `/search` before a
deployment is accepted.

## Deployment

Cloudflare Workers Builds deploys pushes to `cloudflare-deploy`. Do not deploy
this Worker manually.

- Worker: `searxng`
- URL: `https://searxng.pundit.workers.dev/`
- Production branch: `cloudflare-deploy`
- Root directory: `/cloudflare`
- Build command: `npm ci && npm test && npm run check`
- Deploy command: `npm run deploy`
- Preview builds: disabled

Required Worker secrets:

- `SEARXNG_AUTH_TOKEN`
- `SEARXNG_SECRET`

Optional provider secrets:

- `BRAVE_API_KEY`
- `SERPER_API_KEY`

Cloudflare owns the dedicated `searxng` build token. Do not copy a local
Wrangler OAuth token into GitHub.

See [PARITY.md](PARITY.md) for the production acceptance contract.
