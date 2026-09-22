# Cloudflare compatibility worker

This Worker is the migration path from SearXNG to a Cloudflare-native search service. The first slice measures outbound HTTP compatibility without exposing an arbitrary URL or query endpoint.

## Routes

- `GET /healthz` returns Worker health.
- `GET /compat` lists the fixed compatibility probes.
- `POST /compat/run` runs selected probes. This route requires `SPIKE_AUTH_TOKEN` as a bearer token.

The probes return status, timing, content type, sampled byte count, and a SHA-256 digest. They do not return or store upstream response content.

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

Cloudflare owns the build token. Do not copy a local Wrangler OAuth token into GitHub.

Add `SPIKE_AUTH_TOKEN` as a runtime secret after the first deployment. Future pushes to `cloudflare-deploy` preserve the secret and deploy the new Worker version.

## Add a probe

Add a fixed probe to `PROBES` in `src/index.js`. Do not accept a caller-supplied URL, request body, header, or search query. Add tests for both the valid probe and rejected caller-controlled input.
