# Metasearch2 consolidation

SearXNG is the search backend. Metasearch2 remains a reference for features that
improve the search experience. The two applications do not need separate public
search deployments once those features have been assessed here.

## Source inventory

| Metasearch2 source | SearXNG status |
| --- | --- |
| Google, Google Scholar, Bing, Brave, Marginalia, Yep | Already in the engine catalog. Availability still depends on each provider. |
| Right Dao | Added as an engine that is disabled by default. It returned parseable results for two queries on 2026-10-02. Enable it in Preferences to use it. |
| Stract | Retired. Its former `/search` endpoint returned HTTP 404 on 2026-10-02. The original search project was [archived in April 2026](https://github.com/StractOrg/stract); the current domain serves a different product. |

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
| Numbat, Fend | Client calculator and server unit converter | Keep the SearXNG tools for arithmetic, selected functions, and common unit conversion. Numbat's full language, Fend's constants, and their autocomplete are retired. Queries outside the supported set remain ordinary searches. |
| Dictionary | Wordnik and other dictionary engines | Keep SearXNG's sources. |
| Thesaurus | English synonym answer using [Datamuse](https://www.datamuse.com/api/) | Explicit single-word queries return up to eight related words with source attribution. Failed or empty lookups leave ordinary results intact. The old Thesaurus.com scraper and its part-of-speech grading are retired. |
| Color picker | Native SearXNG answer with a browser color input | `color picker`, hex, and `rgb(r, g, b)` queries show an editable hex value and copy feedback. CMYK, HSV, and HSL query parsing from Metasearch2 is retired. |
| Notepad | None | Do not put a browser-only, unsaved text editor in the search result page. |
| IP, user agent, timezone, Wikipedia | Self Information, Timezones, and Wikipedia | Keep SearXNG's built-in paths. |

The Datamuse API currently permits unkeyed requests within its stated daily
limit, asks customer-facing apps to contact its operator, and says API keys
will be required from 2027-01-01. The answer links to Datamuse and this page
credits the source. The integration is bounded to explicit single-word queries
and a short timeout. Before the announced key requirement, arrange continued
access or replace the source. This is an external dependency, not a bundled
thesaurus.

## Search behavior and clients

Metasearch2 adds `engine_weight / position` across duplicate URLs. SearXNG
also merges duplicates, but multiplies engine weights and accounts for how many
positions contributed. Its hostnames plugin can change priorities, while
Metasearch2 also rewrites full URLs, including Minecraft Fandom paths. Blindly
copying Metasearch2's weights would change SearXNG's broader engine catalog.

Metasearch2's JSON API was disabled in its default configuration, and its own
README warned that the serialized internal structs were unstable. The local
client audit found uMzingeli using the SearXNG JSON shape and bearer token; it
found no client requiring the old Metasearch2 JSON shape. No compatibility API
was added. Unknown external clients remain unverified.

On 2026-10-02, the legacy search hostname and the SearXNG hostname both served
SearXNG HTML. Six representative searches on the former returned results:
GitHub site search (26), Minecraft Wiki (24), Python documentation (26),
English synonyms (23), unit conversion (28, with a `200 cm` answer), and a hex
color (20). These are point-in-time observations, not evidence of identical
ranking or provider uptime. The old Metasearch2 runtime was unavailable for a
live side-by-side comparison.

uMzingeli's active search sources use `SEARXNG_BASE_URL` and the SearXNG JSON
shape. Link Extractor 9000 still classifies the `search` hostname as
Metasearch2 and uses its old result selector. uMlindi retains a legacy
Metasearch2 health check. Link Extractor is intentionally left at its restored
state; its old selector is not compatible with SearXNG markup on that hostname.

Metasearch2 streamed engine progress in the HTML response. SearXNG waits for
its search result page. Keeping SearXNG's normal page avoids a second response
path and preserves its upstream UI. Search is already being served on the old
hostname, but repository work alone cannot prove that no external client still
depends on Metasearch2's JSON response.
