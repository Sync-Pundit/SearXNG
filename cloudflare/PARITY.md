# Production parity contract

This contract compares the retained production SearXNG behavior with the
Cloudflare deployment. The migration uses the application in this repository;
it is not an engine-by-engine JavaScript imitation.

## Architecture decision

The original compatibility Worker proved that Cloudflare egress could reach
individual providers, but it implemented only a small general-search subset.
It could not truthfully provide SearXNG's category catalog, preferences,
plugins, engine selection, ranking, or rich result templates.

The production migration therefore uses each Cloudflare primitive for the work
it is good at:

| Concern | Owner |
| --- | --- |
| CSS, JavaScript, fonts, and images | Workers Static Assets |
| Browser versus machine access policy | Edge Worker |
| Health and edge timing | Edge Worker |
| Full SearXNG routes and UI | Cloudflare Container |
| Engines, aggregation, ranking, preferences, plugins | Retained Python SearXNG |
| Container identity and lifecycle | Durable Object-backed Container binding |

## Required behavior

| Area | Cloudflare implementation | Acceptance |
| --- | --- | --- |
| Home and Simple theme | Upstream templates and assets | Home renders one logo and the normal upstream controls |
| Public browser search | Native SearXNG HTML | No token field or bearer token is required in the browser |
| Machine search | Native SearXNG JSON behind Worker gate | Missing/wrong bearer is denied; valid bearer reaches SearXNG |
| Preferences | Native SearXNG preferences | Language, SafeSearch, theme, plugins, and engine controls render and persist |
| Categories | Native SearXNG catalog | General, images, videos, news, map, music, IT, science, files, and social media are present |
| Engines | Native engine catalog plus retained fork changes | Engine preferences and bangs use SearXNG behavior |
| Brave | Distinct `brave` HTML and `braveapi` API engines | Each can be selected independently |
| Serper | Retained conditional post-search plugin | Runs only after a queried Google primary returns no result |
| Result types | Native SearXNG templates and models | Web, image, video, answer, infobox, suggestion, and download behavior stay upstream-owned |
| Plugins | Retained production plugin configuration | Calculator, hash, self-info, units, hostname, timezone, and tracker cleanup remain available |
| Static files | Asset-first Cloudflare delivery | Static requests bypass Worker/Container and carry cache headers |
| Failure state | Retryable edge response | Container startup returns `503` and `Retry-After`, never a fake empty search |

## Performance contract

The incomplete Worker had two measured latency faults:

1. `run_worker_first: true` routed every asset through JavaScript while CSS used
   `max-age=0, must-revalidate`.
2. Provider adapters used 8 to 20 second waits, so one degraded default engine
   held the entire page open.

The migration replaces those paths:

- Static assets are served before Worker code and cache for one hour with a
  one-day stale-while-revalidate window.
- SearXNG queries providers concurrently.
- The deployment request timeout is 3 seconds and the hard maximum is 5
  seconds.
- The Serper fallback has its own 3 second ceiling and failure is non-fatal.
- `Server-Timing` separates edge forwarding time from application work.
- The single analyst Container stays warm for 24 hours after use.

Cloudflare Container cold starts are an explicit limitation. A cold request may
take several seconds; the health endpoint remains edge-only and a starting
Container produces a retryable status rather than incomplete results.

## Acceptance gates

The migration is ready for a branch deployment only when all of these pass:

1. Worker router tests cover public HTML, bearer-gated JSON, POST denial, header
   stripping, health, and startup failure.
2. The real Container starts from the repository image.
3. Home, Preferences, and representative category controls render from that
   Container.
4. A browser search returns native result markup and provider provenance.
5. JSON output works through the bearer gate used by Threat Hunter.
6. Static assets are served by the asset binding with the declared cache
   policy.
7. Threat Hunter supplies `SEARXNG_AUTH_TOKEN`; it must not rely on the old
   unauthenticated JSON endpoint.

Do not mark a blank, unavailable, or timed-out provider as an empty successful
search. Preserve SearXNG's provider failure evidence and partial-result
behavior.
