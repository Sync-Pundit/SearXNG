# SearXNG mobile design

This review branch starts at `cloudflare-deploy` commit
`f7e5b0f889aa56c29de5947af21eb334bf1a7cc0`. It adds a mobile interface to
the retained Simple theme. The Worker request boundary, provider fallback,
ranking, engine catalog and preference storage are unchanged.

AI disclosure: OpenAI Codex audited the source and live instance, designed and
implemented these changes, authored fixtures/documentation, and ran validation
under the instance owner's direction. This is an AI-assisted design branch for
human review. No upstream issue or pull request has been authored by Codex.

## Page inventory

The audit covers every HTML page family and the supporting route types in
`searx/webapp.py`, including every Simple-theme result and answer template.
Non-HTML endpoints remain native services rather than receiving invented UI.

| Surface | Existing routes or states | Mobile treatment |
| --- | --- | --- |
| Search start | `/`, form/category selection, autocomplete | Clear search field, six quick category tiles, all categories in a sheet, bottom search access |
| Results | `/search`; General, Images, Videos, News, Map, Music, IT, Science, Files, Social Media | Sticky query/category rail, compact filter summary, full descriptions, source provenance and result actions |
| Result layouts | default, images, videos, map, code, paper, file, keyvalue, products, packages, torrent | Appropriate cards, readable metadata, contained horizontal code scrolling, two-column phone image grid |
| Answers | legacy, color, translations, weather | Inline answers; weather changes from a wide table to labelled rows |
| Result context | infoboxes, suggestions, corrections, engine errors, timings, search URL, export forms | Context sheet preserves the original DOM, forms and listeners; corrections stay beside results |
| Result states | mixed layouts, no results, partial engine failure, numbered/previous/next pages | No fabricated result counts; pagination submits original forms with query/filter state |
| Image viewer | full image, metadata, source links, previous/next, native swipes | Viewport-sized viewer, safe-area controls, focus containment, browser Back; focus restoration avoids reopening the image |
| Preferences | `/preferences`: General, User interface, Privacy, Engines, Special queries, Cookies | Section chooser, one-column fieldsets, persistent Save, unsaved-edit prompt |
| Engine preferences | all native category tabs, tokens, enable/disable-all, descriptions | Searchable engine cards retaining every form field and the native reversed-checkbox semantics |
| Preference transport | POST save, shareable settings URL, preview/import, cookie inspection, reset | Original handlers and forms retained; no additional key or query storage |
| Instance information | `/info/<locale>/about`, `/info/<locale>/search-syntax`; `/about` redirects | Reading layout, contained examples, bottom Contents navigator |
| Information translations | en, de, it, id, fr, fa-IR (source directory fa_IR); both documents in each directory | Shared layout; audit checks rendering, not linguistic correctness |
| Statistics | `/stats`; name/score/result_count/time/reliability sorting, selected engine, error details, empty metrics | Metric cards, Sort sheet and readable technical reports |
| Missing page | 404 handler | Native error copy plus accessible search/navigation |
| Discovery and assets | `/manifest.json`, `/opensearch.xml`, `/rss.xsl`, `/logo/<resolution>`, `/favicon.ico`, static assets | Native payloads retained |
| Browser helpers | `/autocompleter`, `/image_proxy`, `/engine_descriptions.json`, `/clear_cookies`, optional `/client<token>.css` | Native endpoints/validation retained; no new permissions |
| Machine/operations | `/config`, `/stats/errors`, `/metrics`, `/robots.txt`, `/healthz`, search JSON/CSV/RSS | Existing routes and edge authentication rules retained |

## Interaction contract

The layout changes at 900 CSS pixels. Mobile enhancements wrap existing search
and preference forms; desktop keeps its native controls. Without JavaScript,
original navigation, filters, results and preferences remain available.

Sheets use native `dialog`, explicit Close, Escape, browser Back and focus
restoration. Input font sizes avoid iOS focus zoom. Dock visibility follows
actual visual-viewport keyboard occlusion, not touch-down; the tapped search
field stays in position before the keyboard opens. Safe areas, short viewports,
landscape and pinch zoom have explicit handling. The document scrolls normally.
Category navigation recognizes deliberate horizontal swipes; vertical scrolling and nested horizontal widgets retain their native gestures.

Native Share is used when available; Copy link has a selectable-text fallback.
New controls use gettext in the repository template. The CSS uses the selected
Simple-theme palette, logical spacing and reduced-motion preferences. No
analytics, search history, offline result cache, device sensors or haptics are
introduced.

The standalone files live in `searx/static/themes/simple/mobile/`; `base.html`
includes them. The existing asset-copy step and Container include them without
rebuilding upstream Vite bundles. Rendering fixtures are developer-only scripts:
production imports neither `mobile-fixtures.py` nor `mobile-serve.py`.

## Reproducing the checks

Start the fixture server with the repository's Python requirements installed:

```sh
.venv/bin/python cloudflare/scripts/mobile-serve.py
```

It renders real Flask/Jinja pages with deterministic provider data. In a second
terminal run `node cloudflare/scripts/mobile-browser.cjs`. It uses Playwright
with Chromium and produces ignored `output/searxng-mobile-results.json`.
`MOBILE_TEST_FILTER` selects a named check. Browser installation/module locations
can be overridden as documented in the runner.

`mobile-firefox.cjs` supplies a separate Gecko check at phone widths. It could
not run in this execution environment because Firefox failed to start under
the available graphics/process-namespace restrictions; it is not reported as
a passed browser test. Physical Firefox, Safari and Chrome checks remain.

`cloudflare/scripts/audit-mobile-live.py` performs a read-only live inventory.
Raw HTML/screenshots stay in ignored `output/`, because live diagnostics can
contain instance-specific information. `MOBILE-VALIDATION.json` records safe
aggregate evidence and limitations. It deliberately distinguishes synthetic
layout fixtures from live searches.

## Preview and rollout

The owner-private preview is separate from the real Cloudflare Worker. It adds
the same CSS/JS to public HTML fetched from the live instance. It forwards only
explicit SearXNG preference cookies, never Sites authentication or incoming
Authorization/IP headers. Queries use the existing instance and its providers.
Preview preferences belong to the preview domain. The preview bootstrap has
English control labels; the repository bootstrap uses gettext.

The real deployment remains unchanged. Pushing to `cloudflare-deploy` triggers
production Workers Builds, so this work belongs on `design/mobile-searxng`
until reviewed. No manual production deploy is part of this design pass.

## Screenshot follow-up: 25 October 2026

Codex corrected the owner-reported alignment failures in the same design branch:

- Focus no longer inherits the upstream full-page search overlay. Query, Clear
  and Search stay in one bounded row before and after keyboard occlusion.
- Result thumbnails share the title row in a grid; URL height and long titles no
  longer invalidate an absolute thumbnail offset. Hostname/path start together.
- Map labels and values stack, so long addresses retain the card's reading width.
- Engine provenance and cached links align within a single footer row; its
  decorative vertical ellipsis is hidden because the card already has actions.
- Preference switches have a 44px target with their thumb inside the track;
  reversed checkbox submission semantics remain intact. Reset/Back each have
  one visible button surface.
- Mastodon account notes are converted from API HTML to plain result text,
  preserving paragraph/line boundaries and omitting active markup. An inert
  text-only client fallback also handles the older live backend used by the
  private preview. It applies only to Mastodon provenance, not arbitrary code
  or mathematical result content.

The new regression checks inspect child element bounds, title/thumbnail
placement, footer baselines, real map cell widths, switch pseudo-elements,
LTR/RTL preferences and safe rendering of a legacy social biography. Checking
only document width had missed these failures. The updated full browser suite
passes 185 route/viewport combinations and ten interaction groups. Python
validation includes three new Mastodon adapter cases (81 tests total).

## Result-category swipes

On mobile result pages, swipe left for the next category and right for the
previous one (directions follow visual order in RTL). Navigation sets the native category selection before submitting its original
form, retains query and filters, and starts the new category on page one. This
also works when the core click handler has not finished loading. The active chip is centered without moving the page vertically. A
small category label confirms intent during the gesture and navigation. No
searches are prefetched or stored.

The gesture stops at either boundary. It reserves the outer 24px for browser
navigation, rejects short/vertical drags, text selections, multitouch and zoomed
panning, and yields to form controls, open sheets/viewers, maps, media, code and
scrollable evidence. Closed image-grid tiles support category swipes; inside the
image viewer, swipes continue to change images. Desktop is unchanged. Checkbox
category mode also submits the original form. Browser page restoration clears
the pending state and restores the category belonging to that result page.

Codex added CDP touch-event checks for native form navigation, preserved filters,
Back, RTL, image viewers, code/maps, nested horizontal scrolling, gesture bounds,
zoom/multitouch and desktop. The full suite now has eleven passing groups;
physical phone/browser testing remains a hands-on check.
