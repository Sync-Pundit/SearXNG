# SPDX-License-Identifier: AGPL-3.0-or-later
"""Conditional Serper_ and Brave Search API_ fallbacks.

SearXNG queries enabled engines in parallel, so an engine cannot conditionally
run after another engine. This plugin performs that decision in
``post_search``: the fallback chain runs only when a configured Google primary
was actually queried and every such primary returned no result.

Per-browser keys from Preferences take precedence over the instance-level
``SERPER_API_KEY`` and ``BRAVE_API_KEY`` defaults.  ``SERPER_PRIMARY_ENGINES``
selects the providers that gate the fallback, and ``SERPER_MAX_PAGE`` limits
paid fallback pagination.

.. _Serper: https://serper.dev/
.. _Brave Search API: https://api.search.brave.com/
"""

import os
import typing as t
from urllib.parse import urlencode

from curl_cffi.requests.exceptions import RequestException
from flask_babel import gettext

from searx import network
from searx.exceptions import SearxEngineResponseException
from searx.result_types import EngineResults

from . import Plugin, PluginInfo

if t.TYPE_CHECKING:
    from searx.extended_types import SXNG_Request
    from searx.search import SearchWithPlugins
    from . import PluginCfg


SERPER_ENDPOINT = "https://google.serper.dev/search"
BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
TIMEOUT = 3.0
RESULTS_PER_PAGE = 10
DEFAULT_PRIMARY_ENGINES = "google,google cse,dogpile,dogpile images,yahoo"
BRAVE_KEY_HEADER = "X-Searxng-Internal-Brave-Key"
SERPER_KEY_HEADER = "X-Searxng-Internal-Serper-Key"


def _primary_engines() -> set[str]:
    raw = os.environ.get("SERPER_PRIMARY_ENGINES") or DEFAULT_PRIMARY_ENGINES
    return {name.strip().lower() for name in raw.split(",") if name.strip()}


class SXNGPlugin(Plugin):
    """Add paid API results only when the queried primary providers were empty."""

    id = "serper_fallback"

    def __init__(self, plg_cfg: "PluginCfg"):
        super().__init__(plg_cfg)
        self.info = PluginInfo(
            id=self.id,
            name=gettext("API fallbacks"),
            description=gettext(
                "Queries Serper, then Brave API, only when the configured primary engines return no results."
            ),
            preference_section="general",
        )

    def init(self, app) -> bool:  # pylint: disable=unused-argument
        self.log.info(
            "API fallbacks active for engines: %s",
            ", ".join(sorted(_primary_engines())),
        )
        return True

    def post_search(
        self, request: "SXNG_Request", search: "SearchWithPlugins"
    ) -> EngineResults:
        results = EngineResults()
        search_query = search.search_query

        try:
            max_page = int(os.environ.get("SERPER_MAX_PAGE", "5"))
        except ValueError:
            max_page = 5
        if search_query.pageno > max_page:
            return results

        primaries = _primary_engines()
        queried = {reference.name.lower() for reference in search_query.engineref_list}
        gating = queried & primaries
        if not gating:
            return results

        for result in search.result_container.main_results_map.values():
            provenance = {name.lower() for name in getattr(result, "engines", set())}
            if provenance & gating:
                return results

        preferences = getattr(request, "preferences", None)
        serper_key = preferences.get_value("serper_api_key") if preferences else ""
        brave_key = preferences.get_value("brave_api_key") if preferences else ""
        serper_key = serper_key or request.headers.get(SERPER_KEY_HEADER, "")
        brave_key = brave_key or request.headers.get(BRAVE_KEY_HEADER, "")
        serper_key = serper_key or os.environ.get("SERPER_API_KEY", "")
        brave_key = brave_key or os.environ.get("BRAVE_API_KEY", "")
        if not serper_key and not brave_key:
            return results

        self.log.debug(
            "primary engines (%s) returned nothing - querying API fallbacks",
            ", ".join(sorted(gating)),
        )
        entries = (
            self._query_serper(search_query.query, search_query.pageno, serper_key)
            if serper_key
            else []
        )
        if not entries and brave_key:
            entries = self._query_brave(
                search_query.query, search_query.pageno, brave_key
            )

        for entry in entries:
            results.add(
                results.types.MainResult(
                    url=entry["url"],
                    title=entry["title"],
                    content=entry["content"],
                )
            )
        return results

    def _query_serper(
        self, query: str, pageno: int, api_key: str
    ) -> list[dict[str, str]]:
        payload: dict[str, t.Any] = {"q": query, "num": RESULTS_PER_PAGE}
        if pageno > 1:
            payload["page"] = pageno

        try:
            response = network.post(
                SERPER_ENDPOINT,
                json=payload,
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
        except (RequestException, SearxEngineResponseException, ValueError) as exc:
            self.log.warning("Serper request failed: %s", exc)
            return []

        output: list[dict[str, str]] = []
        for item in data.get("organic") or []:
            url = item.get("link")
            if not url:
                continue
            output.append(
                {
                    "url": url,
                    "title": item.get("title") or url,
                    "content": item.get("snippet") or "",
                }
            )
        self.log.debug(
            "Serper returned %d result(s), credits used: %s",
            len(output),
            data.get("credits"),
        )
        return output

    def _query_brave(
        self, query: str, pageno: int, api_key: str
    ) -> list[dict[str, str]]:
        search_args: dict[str, str | int | bool] = {
            "q": query,
            "count": RESULTS_PER_PAGE,
            "offset": pageno - 1,
            "text_decorations": False,
        }

        try:
            response = network.get(
                f"{BRAVE_ENDPOINT}?{urlencode(search_args)}",
                headers={
                    "X-Subscription-Token": api_key,
                    "Accept": "application/json",
                },
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
        except (RequestException, SearxEngineResponseException, ValueError) as exc:
            self.log.warning("Brave API request failed: %s", exc)
            return []

        output: list[dict[str, str]] = []
        for item in (data.get("web") or {}).get("results") or []:
            url = item.get("url")
            if not url:
                continue
            output.append(
                {
                    "url": url,
                    "title": item.get("title") or url,
                    "content": item.get("description") or "",
                }
            )
        self.log.debug("Brave API returned %d result(s)", len(output))
        return output
