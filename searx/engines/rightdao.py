# SPDX-License-Identifier: AGPL-3.0-or-later
"""Right Dao web search."""

import typing as t
from urllib.parse import urlencode, urlsplit

from searx.result_types import EngineResults
from searx.utils import extract_text

if t.TYPE_CHECKING:
    from searx.extended_types import SXNG_Response
    from searx.search.processors import OnlineParams


about = {
    "website": "https://rightdao.com/",
    "official_api_documentation": None,
    "use_official_api": False,
    "require_api_key": False,
    "results": "HTML",
}

categories = ["general"]
paging = False
base_url = "https://rightdao.com"


def request(query: str, params: "OnlineParams") -> None:
    params["url"] = f"{base_url}/search?{urlencode({'q': query})}"


def response(resp: "SXNG_Response") -> EngineResults:
    results = EngineResults()
    for item in resp.html().xpath(
        "//div[contains(concat(' ', normalize-space(@class), ' '), ' item ')]"
    ):
        links = item.xpath(
            ".//div[contains(concat(' ', normalize-space(@class), ' '), ' title ')]//a[@href]"
        )
        if not links:
            continue
        url = links[0].get("href") or ""
        try:
            parsed = urlsplit(url)
        except ValueError:
            continue
        if parsed.scheme not in ("https", "http") or not parsed.netloc:
            continue
        title = extract_text(links[0]) or ""
        if not title:
            continue
        descriptions = item.xpath(
            ".//div[contains(concat(' ', normalize-space(@class), ' '), ' description ')]"
        )
        results.add(
            results.types.MainResult(
                url=url,
                title=title,
                content=(extract_text(descriptions[0]) or "") if descriptions else "",
            )
        )
    return results
