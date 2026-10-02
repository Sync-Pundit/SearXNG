# Metasearch2 consolidation

SearXNG is the search backend. Metasearch2 remains a reference for features that
improve the search experience. The two applications do not need separate public
search deployments once those features have been assessed here.

## Source inventory

| Metasearch2 source | SearXNG status |
| --- | --- |
| Google, Google Scholar, Bing, Brave, Marginalia, Yep | Already in the engine catalog. Availability still depends on each provider. |
| Right Dao | Added as an engine that is disabled by default. It returned parseable results for two queries on 2026-10-02. Enable it in Preferences to use it. |
| Stract | Held back. Its former `/search` endpoint returned HTTP 404 on 2026-10-02. |

Metasearch2 also contains answers and page previews. They are different from
search sources and belong in SearXNG plugins rather than engine adapters.

## Result previews

The optional Result preview plugin checks the eight highest-ranked results on
the first HTML page. It supports GitHub repositories, MDN, docs.rs, and
Minecraft Wiki articles. Minecraft Wiki uses its plaintext article API because
the normal article page is large and was blocked from this runtime. With an
optional `STACKEXCHANGE_API_KEY` Worker secret, it also shows an accepted
Stack Exchange answer. Its API response is cached in each Python process for
one minute, and API backoff and exhausted quota suppress further requests.
Without the key, Stack Exchange results remain ordinary links.

The plugin makes at most one outbound request per search, with a 1.5-second
timeout. Only exact HTTPS hosts are eligible, and redirects are not followed.
An existing infobox takes precedence. JSON searches do not run the plugin.

The plugin is enabled by default and can be disabled in Preferences. A failed
page fetch leaves the ordinary results intact.

## Instant tools

| Metasearch2 tool | SearXNG path | Decision |
| --- | --- | --- |
| Numbat, Fend | Client calculator and server unit converter | Keep the SearXNG tools. They handle ordinary arithmetic and unit conversion, but do not cover Numbat's full language or Fend's constants. Do not add a second evaluator without a concrete use case. |
| Dictionary | Wordnik and other dictionary engines | Keep SearXNG's sources. |
| Thesaurus | General web results; the German Woxikon synonym engine is in the catalog | An English instant synonym answer remains a gap. The old Thesaurus.com scraper is brittle. [Datamuse](https://www.datamuse.com/api/) has a documented synonym API, but asks customer-facing apps to contact them before use. |
| Color picker | Search results for color values | An interactive picker remains a gap. It is a browser tool rather than a search provider. |
| Notepad | None | Do not put a browser-only, unsaved text editor in the search result page. |
| IP, user agent, timezone, Wikipedia | Self Information, Timezones, and Wikipedia | Keep SearXNG's built-in paths. |

## Search behavior and clients

Metasearch2 adds `engine_weight / position` across duplicate URLs. SearXNG
also merges duplicates, but multiplies engine weights and accounts for how many
positions contributed. Its hostnames plugin can change priorities, while
Metasearch2 also rewrites full URLs, including Minecraft Fandom paths. Blindly
copying Metasearch2's weights would change SearXNG's broader engine catalog.

On 2026-10-02, `search.syncpundit.io` and `searx.syncpundit.io` both served
SearXNG HTML. Six representative searches on the former returned results:
GitHub site search (26), Minecraft Wiki (24), Python documentation (26),
English synonyms (23), unit conversion (28, with a `200 cm` answer), and a hex
color (20). These are point-in-time observations, not evidence of identical
ranking or provider uptime. The old Metasearch2 runtime was unavailable for a
live side-by-side comparison.

uMzingeli's active search sources use `SEARXNG_BASE_URL` and the SearXNG JSON
shape. Link Extractor 9000 had classified the `search` hostname as Metasearch2;
its separate change updates that host to SearXNG. uMlindi retains a legacy
Metasearch2 health check. The old JSON format differs from SearXNG's. Unknown
external clients may still depend on it.

Metasearch2 streamed engine progress in the HTML response. SearXNG waits for
its search result page. Keeping SearXNG's normal page avoids a second response
path and preserves its upstream UI. Search is already being served on the old
hostname, but repository work alone cannot prove that no external client still
depends on Metasearch2's JSON response.
