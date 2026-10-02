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
the first HTML page. If one points to a GitHub repository, MDN documentation,
or docs.rs, the plugin fetches that page and shows a short text preview in the
existing infobox area. It makes at most one request, with a 1.5-second timeout.
Only exact HTTPS hosts are eligible, and redirects are not followed. An
existing infobox takes precedence. JSON searches do not run the plugin.

The plugin is enabled by default and can be disabled in Preferences. A failed
page fetch leaves the ordinary results intact.

## Still to assess

- Metasearch2's page previews for Minecraft Wiki and Stack Exchange.
- Its specialized instant tools, including Numbat, Fend, thesaurus, color
  picker, and notepad. Compare each with SearXNG's existing answers before
  moving it.
- Ranking differences. SearXNG already weights engines and positions, but its
  duplicate handling and result order are not identical to Metasearch2's.
- Metasearch2's streamed progress UI. SearXNG currently renders its normal
  results page after the search completes.

Do not retire Metasearch2 or redirect a hostname on the strength of this first
change alone. Compare representative queries and confirm that any clients of
its JSON format have a compatible SearXNG path.
