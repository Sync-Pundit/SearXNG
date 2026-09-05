# SyncPundit SearXNG divergence

This directory contains the configuration and deployment files that turn the
fork into the Threat Hunter search backend. The changes are additive so
`git merge upstream/master` stays manageable.

## What this adds

| Change | Where | Type |
|---|---|---|
| Environment YAML tags for secrets and credential-gated engines | `searx/settings_loader.py` | patched upstream file |
| Brave API paging fix (offset is a page index) | `searx/engines/braveapi.py` | patched upstream file (bug fix) |
| JSON output (`formats: [html, json]`) | `prod/settings.yml` | override |
| `method: "GET"` (pairs with the nginx gate) | `prod/settings.yml` | override |
| Shorter Google CAPTCHA suspension | `prod/settings.yml` | override |
| Brave Search API engine (activated when configured) | `prod/settings.yml` | override (stock engine) |
| Predictable engine and bot-detection defaults | `prod/settings.yml`, `prod/limiter.toml` | override |
| Own container image | `prod/docker-compose.yml` | deployment |
| Proxy headers + JSON API gate | `prod/nginx/sites-enabled-default.conf` | deployment (full `sites-enabled/default` replacement) |

Four upstream files are changed, each in its own commit to limit merge
conflicts. Three changes fix upstream bugs and can be dropped if upstream lands
equivalent fixes:

- `settings_loader.py`: the `!env` and `!env_not_set` tags (features this fork adds).
- `braveapi.py`: Brave's `offset` parameter is a zero-based *page* index
  (valid 0-9), but the engine sent `(pageno-1) * results_per_page`, for example
  `offset=20` for page 2. Brave rejects that with HTTP 422, so the engine
  could only ever return page 1.
- `duckduckgo.py`: a `web-result` div lacking `<h2><a href>` raised
  IndexError out of `response()`, discarding *every* result on the page
  rather than the one malformed entry. Accounted for 30% of DDG's errors.
- `results.py`: plugin-generated results carry synthetic provenance such as
  `plugin: serper_fallback`, which has no engine metrics entry. Scoring used to
  index that name unconditionally and turn a valid fallback into HTTP 500.

## Serper fallback

`searx/plugins/serper_fallback.py` (new file, not a patch) calls the Serper API
only when every primary Google engine that actually ran returned zero
results. SearXNG fires all engines in parallel and has no conditional-engine
mechanism, so this lives in a `post_search` hook. That hook can see
the finished result set and still contribute results.

Env config (already loaded from `prod/.env`):

| Variable | Default | Notes |
|---|---|---|
| `SERPER_API_KEY` | none | Required; without it the plugin deactivates at startup |
| `SERPER_PRIMARY_ENGINES` | `google,google cse` | Only engines that *actually ran* can gate |
| `SERPER_MAX_PAGE` | `5` | Stops deep pagination burning a credit per page |

Costs 1 credit per fired request, 0 when a primary engine answers.

### Free-tier limit

Serper rejects advanced query patterns (`site:`, quoted
phrases) when `num > 10` with HTTP 400 *"Query pattern not allowed for free
accounts"*. Since every harness query is a dork, `RESULTS_PER_PAGE` is pinned
to 10. Raise it only on a paid plan.

The upstream default marks `google` as `inactive: true`, inherited through
`use_default_settings`. In practice, only `google cse` gates the fallback.

## Engine policy

Keep engine choice available to the client. Do not add `inactive: true` or an
engine to `preferences.lock`. A measured problem may justify `disabled: true`
because the client can still enable that engine in preferences.

Current state:

- `bing`: `disabled: true`. It does not answer dorks: `site:` queries
  are CAPTCHA-walled from any IP, and once a human solves that, the quoted
  phrase is silently dropped (`site:webflow.io "MetaMask"` returned Lottie
  animations and Minecraft texture packs). Plain queries from this IP are
  degraded too.
- `brave` (HTML scraper) and `startpage`: `disabled: true`. Live Compose
  checks reproduced rate limiting and a CAPTCHA on every acceptance pass.
  Both remain loaded, so clients can enable them explicitly.

Mechanics, for when this comes up again:

- `disabled: true`: engine off *by default*; a client can still switch it on.
  A saved preferences cookie (`disabled_engines`/`enabled_engines`) overrides
  the default per-browser, so a config change won't affect existing sessions
  until the cookie is cleared or preferences re-saved.
- `inactive: true`: engine not loaded at all; a client cannot enable it.
  Don't use this here.
- `preferences.lock`: forces a setting instance-wide and removes client
  choice. Contains exactly one entry, `method`, and only because the nginx
  JSON gate depends on it (see below). Nothing else is locked.

Note some engines ship `disabled: true` from **upstream** (e.g. `bing`,
`google`'s `inactive: true`). Those are upstream defaults, not ours, and
clients can still enable the `disabled` ones in preferences.

### Why urlscan.io is not here

IOC-verdict lookups are already handled by Odin's
Eye (`~/Documents/syncpundit/odin/backend/services/ioc_providers/urlscan.py`);
the free-text discovery/search use case lives in
`~/Documents/syncpundit/threat-hunter/threat-intel/urlscan.py`. SearXNG isn't
the right place for either. See the note in `prod/settings.yml`.

## Why we build our own image

Prod previously ran `docker.io/searxng/searxng` (upstream prebuilt) with a
mounted settings file. That no longer works: the `!env` tag is implemented in
our `searx/settings_loader.py`, so an upstream image cannot parse
`prod/settings.yml`. It exits with *"could not determine a constructor for the
tag '!env'"*.

The settings file and the image are coupled. Never point this
settings.yml at an upstream image, and never `docker pull` over our tag.

This removes `docker pull` as an update path. Upstream changes
require a rebuild (see *Updating* below). If that ever becomes unwelcome, the
alternative is to drop the `settings_loader.py` patch and generate settings.yml
from a template with `envsubst` at deploy time, which keeps stock images
usable. Another option is the bare-metal `utils/searxng.sh install`, which runs
the code from a Git checkout without a build step but requires moving off
Docker.

## Build

Requires: git checkout with a remote, `docker buildx`, and a committed tree
(the build derives version metadata from `git rev-parse HEAD`).

```bash
cd /path/to/searx
GITHUB_REPOSITORY_OWNER=syncpundit ./manage container.build docker
```

Produces `localhost/syncpundit/searxng:latest` plus a `:<version>` tag.
Without `GITHUB_REPOSITORY_OWNER` the image is named `localhost/searxng/searxng`,
which is easy to confuse with the upstream image. Set the owner explicitly.

## Deploy

1. Create the secrets file. `prod/.env` is ignored by Git:

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

3. nginx. This host keeps **every vhost in one file**,
   `/etc/nginx/sites-enabled/default`, so `prod/nginx/sites-enabled-default.conf`
   is a complete replacement for it, not a drop-in. Copy it over, then make the
   single edit it asks for:

   ```bash
   sudo cp prod/nginx/sites-enabled-default.conf /etc/nginx/sites-enabled/default
   ```

   Uncomment the one token line in the `$th_authed` map and paste a token:

   ```bash
   openssl rand -hex 32
   ```

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

   Rotation = edit that line, reload. The token lives only in the deployed
   file, which is not in git.

   Never commit the token or ship an active placeholder. On 2026-07-25,
   `REPLACE_ME_WITH_A_32_BYTE_HEX_TOKEN` reached production unchanged and
   granted JSON API access until it was rotated. The committed map keeps the
   token line commented out, so an unmodified deployment authenticates nobody.

   Two nginx behaviours worth knowing, both verified against `nginx:alpine`:

   - Duplicate `map` blocks do not error. Two maps defining `$th_authed`
     silently resolve to the last one. A stale map further down the file
     will quietly override this gate with no warning.
   - `map` matches string keys case-insensitively, so a lowercase hex
     token matches a mixed-case key. Case is never the cause of a 403 here.

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
