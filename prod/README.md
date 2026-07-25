# SyncPundit SearXNG divergence

Config-as-code layer that turns the vanilla fork into the threat-hunter
harness backend. Everything here is **additive** so `git merge upstream/master`
stays clean.

## What this adds

| Change | Where | Type |
|---|---|---|
| `!env` YAML tag for env-injected secrets | `searx/settings_loader.py` | patched upstream file |
| Brave API paging fix (offset is a page index) | `searx/engines/braveapi.py` | patched upstream file (bug fix) |
| JSON output (`formats: [html, json]`) | `prod/settings.yml` | override |
| `method: "GET"` (pairs with the nginx gate) | `prod/settings.yml` | override |
| Shorter Google CAPTCHA suspension | `prod/settings.yml` | override |
| Brave Search API engine (activated) | `prod/settings.yml` | override (stock engine) |
| Own container image | `prod/docker-compose.yml` | deployment |
| Proxy headers + JSON API gate | `prod/nginx/` | deployment |

Three upstream files are touched, each quarantined to its own commit so merge
conflicts stay minimal. The latter two are upstream bugs — worth submitting,
and droppable if/when they land upstream:

- `settings_loader.py` — the `!env` tag (a feature this fork adds).
- `braveapi.py` — Brave's `offset` parameter is a zero-based *page* index
  (valid 0–9), but the engine sent `(pageno-1) * results_per_page`, i.e.
  `offset=20` for page 2. Brave rejects that with HTTP 422, so the engine
  could only ever return page 1.
- `duckduckgo.py` — a `web-result` div lacking `<h2><a href>` raised
  IndexError out of `response()`, discarding *every* result on the page
  rather than the one malformed entry. Accounted for 30% of DDG's errors.

## Serper fallback

`searx/plugins/serper_fallback.py` (new file, not a patch) calls the Serper API
**only** when every primary Google engine that actually ran returned zero
results. SearXNG fires all engines in parallel and has no conditional-engine
mechanism, so this lives in a `post_search` hook — the one place that can see
the finished result set and still contribute results.

Env config (already loaded from `prod/.env`):

| Variable | Default | Notes |
|---|---|---|
| `SERPER_API_KEY` | — | Required; without it the plugin deactivates at startup |
| `SERPER_PRIMARY_ENGINES` | `google,google cse` | Only engines that *actually ran* can gate |
| `SERPER_MAX_PAGE` | `5` | Stops deep pagination burning a credit per page |

Costs 1 credit per fired request, 0 when a primary engine answers.

**Free-tier limit:** Serper rejects advanced query patterns (`site:`, quoted
phrases) when `num > 10` — HTTP 400 *"Query pattern not allowed for free
accounts"*. Since every harness query is a dork, `RESULTS_PER_PAGE` is pinned
to 10. Raise it only on a paid plan.

**Note `google` is currently `inactive: true`** (upstream default, inherited via
`use_default_settings`), so in practice only `google cse` gates the fallback.

## Engine notes

`disabled: true` only sets the **default**; a saved preferences cookie
overrides it per-browser (`disabled_engines`/`enabled_engines`). After
changing engine defaults, clear the instance's cookie or re-save preferences,
otherwise existing sessions keep querying the old set. To enforce centrally,
add the setting to `preferences.lock` instead.

**Not here:** urlscan.io. IOC-verdict lookups are already handled by Odin's
Eye (`~/Documents/syncpundit/odin/backend/services/ioc_providers/urlscan.py`);
the free-text discovery/search use case lives in
`~/Documents/syncpundit/threat-hunter/threat-intel/urlscan.py`. SearXNG isn't
the right place for either — see the note in `prod/settings.yml`.

## Why we build our own image

Prod previously ran `docker.io/searxng/searxng` (upstream prebuilt) with a
mounted settings file. That no longer works: the `!env` tag is implemented in
**our** `searx/settings_loader.py`, so an upstream image cannot parse
`prod/settings.yml` — it dies with *"could not determine a constructor for the
tag '!env'"*.

The settings file and the image are now **coupled**. Never point this
settings.yml at an upstream image, and never `docker pull` over our tag.

Cost of this choice: no more `docker pull` for updates — upstream changes
require a rebuild (see *Updating* below). If that ever becomes unwelcome, the
alternative is to drop the `settings_loader.py` patch and generate settings.yml
from a template with `envsubst` at deploy time, which keeps stock images
usable. (Bare-metal `utils/searxng.sh install` is the other option — it runs the
code straight from a git checkout with no build step — but it would mean
migrating off Docker entirely.)

## Build

Requires: git checkout with a remote, `docker buildx`, and a committed tree
(the build derives version metadata from `git rev-parse HEAD`).

```bash
cd /path/to/searx
GITHUB_REPOSITORY_OWNER=syncpundit ./manage container.build docker
```

Produces `localhost/syncpundit/searxng:latest` plus a `:<version>` tag.
Without `GITHUB_REPOSITORY_OWNER` the image is named `localhost/searxng/searxng`,
which is confusingly close to the upstream image — set it.

## Deploy

1. Secrets (never in git — `prod/.env` is gitignored):

   ```bash
   cp prod/.env.example prod/.env
   # SEARXNG_SECRET=$(openssl rand -hex 32), BRAVE_API_KEY=...
   ```

2. Bring it up:

   ```bash
   cd prod && docker compose up -d
   ```

   The container listens on **8080** and is published to **127.0.0.1 only**, so
   nginx is the sole way in.

3. nginx:

   ```bash
   sudo cp prod/nginx/searx.syncpundit.io.conf /etc/nginx/conf.d/
   # edit it: replace the bearer token placeholder with `openssl rand -hex 32`
   sudo nginx -t && sudo systemctl reload nginx
   ```

### Local dev (no container)

```bash
set -a; . prod/.env; set +a
export SEARXNG_SETTINGS_PATH="$PWD/prod/settings.yml"
./manage webapp.run
```

## Updating from upstream

```bash
git fetch upstream && git merge upstream/master   # expect conflicts only in settings_loader.py
GITHUB_REPOSITORY_OWNER=syncpundit ./manage container.build docker
cd prod && docker compose up -d
```

## Verify

```bash
# HTML still works, and JSON is blocked without the token
curl -s -o /dev/null -w '%{http_code}\n' 'https://searx.syncpundit.io/search?q=test'                 # 200
curl -s -o /dev/null -w '%{http_code}\n' 'https://searx.syncpundit.io/search?q=test&format=json'     # 403

# JSON works for the harness
curl -s -H 'Authorization: Bearer <token>' \
  'https://searx.syncpundit.io/search?q=site:github.io+%22Metamask%22&format=json' | jq '.results[].url'

# Brave API backend (confirmed live 2026-07-25: 18 results, honours site: dorks)
curl -s -H 'Authorization: Bearer <token>' \
  'https://searx.syncpundit.io/search?q=%21braveapi+metamask&format=json' | jq '.results[].url'
```

## Security notes

- **Never publish the container port on 0.0.0.0.** Docker bypasses the host
  firewall; `8080:8080` would expose an ungated JSON API on the box's public IP.
- The bearer token lives in the nginx config, not in SearXNG. Rotating it is an
  nginx edit + reload.
- `limiter: false` and `valkey.url: false` remain upstream-default-off. If this
  instance ever takes real public traffic, enable both together (valkey service
  is stubbed in `docker-compose.yml`).
