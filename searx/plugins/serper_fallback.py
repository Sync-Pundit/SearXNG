# SPDX-License-Identifier: AGPL-3.0-or-later
"""Conditional Serper_ fallback.

SearXNG queries every enabled engine in parallel; there is no built-in way to
say "only run engine B if engine A came back empty". Engines cannot see each
other's results at request time, so a conditional fallback has to live in a
plugin's :py:obj:`post_search` hook, which runs after the search and may return
extra results.

This plugin calls the Serper API only when every primary engine that was
actually queried returned zero results. Serper bills one credit per request, so
the plugin spends nothing when a primary engine answers.

Configuration is via environment variables (the container already loads
``prod/.env``):

``SERPER_API_KEY``
  Required. Without it the plugin deactivates itself at startup.

``SERPER_PRIMARY_ENGINES``
  Comma-separated engine names that count as "primary". Default
  ``google,google cse``. Note that an engine which is ``inactive`` or
  ``disabled`` is never queried, so it cannot gate anything. Only engines that
  actually ran are considered.

``SERPER_MAX_PAGE``
  Highest page number the fallback will fire on (default 5). Guards against a
  zero-result query burning a credit on every page of deep pagination.

.. _Serper: https://serper.dev/
"""

import os
import typing as t

import httpx
from flask_babel import gettext

from searx import network
from searx.result_types import EngineResults

from . import Plugin, PluginInfo

if t.TYPE_CHECKING:
    from searx.search import SearchWithPlugins
    from searx.extended_types import SXNG_Request
    from . import PluginCfg


ENDPOINT = "https://google.serper.dev/search"
TIMEOUT = 10
RESULTS_PER_PAGE = 10
"""Serper's free tier rejects advanced query patterns (``site:``, quoted
phrases) when ``num`` exceeds 10, answering HTTP 400 *"Query pattern not
allowed for free accounts"*. Since every query this harness makes is a dork,
10 is the only safe value here. Raise it only on a paid plan."""

DEFAULT_PRIMARY_ENGINES = "google,google cse"


def _primary_engines() -> set[str]:
    raw = os.environ.get("SERPER_PRIMARY_ENGINES") or DEFAULT_PRIMARY_ENGINES
    return {name.strip().lower() for name in raw.split(",") if name.strip()}


class SXNGPlugin(Plugin):
    """Falls back to the Serper API when the primary Google engines return
    nothing for a query."""

    id = "serper_fallback"

    def __init__(self, plg_cfg: "PluginCfg"):
        super().__init__(plg_cfg)

        self.info = PluginInfo(
            id=self.id,
            name=gettext("Serper fallback"),
            description=gettext(
                "Queries the Serper API only when the primary Google engines return no results."
            ),
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

        # Only engines that were actually queried can gate the fallback. An
        # inactive/disabled engine never runs, so treating its silence as
        # "Google failed" would fire Serper on every single search.
        queried = {ref.name.lower() for ref in search_query.engineref_list}
        gating = queried & primaries
        if not gating:
            return results

        # `close()` (which scores and orders) runs after post_search, so read
        # the merged map directly rather than get_ordered_results().
        for result in search.result_container.main_results_map.values():
            if {name.lower() for name in getattr(result, "engines", set())} & gating:
                # A primary engine answered - no need to spend a credit.
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
            # searx.network (httpx) rather than a bare client, so the request
            # honours the instance's `outgoing:` proxy/timeout configuration.
            resp = network.post(
                ENDPOINT,
                json=payload,
                headers={
                    "X-API-KEY": os.environ["SERPER_API_KEY"],
                    "Content-Type": "application/json",
                },
                timeout=TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            # A failing fallback must never break the search it is helping.
            self.log.warning("Serper request failed: %s", exc)
            return []

        out: list[dict[str, str]] = []
        for item in data.get("organic") or []:
            url = item.get("link")
            if not url:
                continue
            out.append(
                {
                    "url": url,
                    "title": item.get("title") or url,
                    "content": item.get("snippet") or "",
                }
            )
        self.log.debug("Serper returned %d result(s), credits used: %s", len(out), data.get("credits"))
        return out
