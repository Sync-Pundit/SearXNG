# SPDX-License-Identifier: AGPL-3.0-or-later
"""Conditional Serper_ fallback.

SearXNG queries enabled engines in parallel, so an engine cannot conditionally
run after another engine. This plugin performs that decision in
``post_search``: Serper runs only when a configured Google primary was actually
queried and every such primary returned no result.

``SERPER_API_KEY`` enables the plugin. ``SERPER_PRIMARY_ENGINES`` selects the
Google providers that gate it, and ``SERPER_MAX_PAGE`` limits paid fallback
pagination.

.. _Serper: https://serper.dev/
"""

import os
import typing as t

from curl_cffi.requests.exceptions import RequestException
from flask_babel import gettext

from searx import network
from searx.result_types import EngineResults

from . import Plugin, PluginInfo

if t.TYPE_CHECKING:
    from searx.extended_types import SXNG_Request
    from searx.search import SearchWithPlugins
    from . import PluginCfg


ENDPOINT = "https://google.serper.dev/search"
TIMEOUT = 3.0
RESULTS_PER_PAGE = 10
DEFAULT_PRIMARY_ENGINES = "google,google cse"


def _primary_engines() -> set[str]:
    raw = os.environ.get("SERPER_PRIMARY_ENGINES") or DEFAULT_PRIMARY_ENGINES
    return {name.strip().lower() for name in raw.split(",") if name.strip()}


class SXNGPlugin(Plugin):
    """Add Serper results only when the queried Google providers were empty."""

    id = "serper_fallback"

    def __init__(self, plg_cfg: "PluginCfg"):
        super().__init__(plg_cfg)
        self.info = PluginInfo(
            id=self.id,
            name=gettext("Serper fallback"),
            description=gettext("Queries Serper only when the primary Google engines return no results."),
            preference_section="general",
        )

    def init(self, app) -> bool:  # pylint: disable=unused-argument
        if not os.environ.get("SERPER_API_KEY"):
            self.log.info("SERPER_API_KEY is not set - Serper fallback stays inactive")
            return False
        self.log.info("Serper fallback active for engines: %s", ", ".join(sorted(_primary_engines())))
        return True

    def post_search(self, request: "SXNG_Request", search: "SearchWithPlugins") -> EngineResults:
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

        self.log.debug("primary engines (%s) returned nothing - querying Serper", ", ".join(sorted(gating)))
        for entry in self._query_serper(search_query.query, search_query.pageno):
            results.add(
                results.types.MainResult(
                    url=entry["url"],
                    title=entry["title"],
                    content=entry["content"],
                )
            )
        return results

    def _query_serper(self, query: str, pageno: int) -> list[dict[str, str]]:
        payload: dict[str, t.Any] = {"q": query, "num": RESULTS_PER_PAGE}
        if pageno > 1:
            payload["page"] = pageno

        try:
            response = network.post(
                ENDPOINT,
                json=payload,
                headers={
                    "X-API-KEY": os.environ["SERPER_API_KEY"],
                    "Content-Type": "application/json",
                },
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
        except (RequestException, ValueError) as exc:
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
        self.log.debug("Serper returned %d result(s), credits used: %s", len(output), data.get("credits"))
        return output
