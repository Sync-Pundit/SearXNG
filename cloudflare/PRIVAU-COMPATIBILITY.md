# PrivAU compatibility decisions

The PrivAU repository is an overlay around a pinned SearXNG fork. It is a
useful feature source, but replacing this repository with that overlay would
discard upstream history and Cloudflare-specific controls.

## Adopted

- Sixteen additional Simple-theme palettes are compiled into the normal
  SearXNG stylesheet and exposed through the native Preferences page.
- The retained fork's additional public engine implementations remain in the
  catalog: Findborg, Iconify, Xprivo, and Brave API.
- Dogpile general and image verticals are available as opt-ins, matching
  PrivAU's configuration. Dogpile obtains and caches its own short-lived
  provider token. It stays off by default because Dogpile may issue an AWS WAF
  challenge to some egress locations.
- Yahoo, Yandex, Wikipedia, DuckDuckGo, Brave HTML, Google CSE, and Google are
  explicit general-search defaults for the Cloudflare deployment.
- Image proxying is enabled so result thumbnails are fetched through the
  Cloudflare-hosted service instead of from the user's browser.
- Yahoo's regional validation cookie is isolated by hostname. One empty
  response receives a bounded retry, while provider errors return immediately
  so Yahoo cannot consume the full metasearch timeout.

## Retained from this deployment

- Browser search remains public. Only JSON output requires the dedicated
  Worker bearer token.
- Brave HTML remains a selectable native engine. Brave API stays a separate
  implementation but is used only as the second API fallback after Serper.
- Users can optionally override the instance Serper and Brave API keys from
  Preferences without exposing those keys in shareable preference URLs.
- Cloudflare chooses Container placement. No geographic region is forced.
- Cloudflare Workers Static Assets serves the compiled theme files before the
  Worker or Container runs.

## Intentionally not copied

- PrivAU names, donation links, contact details, and privacy-policy text.
- Its custom password API and captcha layer. The Worker owns machine access,
  while Cloudflare owns deployment and platform controls.
- Its Docker wrapper and runtime monkey patches. The Cloudflare Container runs
  the maintained SearXNG application directly.
- Provider defaults tied to PrivAU's network. Engine defaults here are based on
  this deployment's measured Cloudflare egress behavior.

Run `npm run parity` from `cloudflare/` after changing themes, engines, Worker
boundaries, or Container placement. The check fails when those migration
contracts drift.
