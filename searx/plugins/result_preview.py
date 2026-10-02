# SPDX-License-Identifier: AGPL-3.0-or-later
"""Show a short preview of a documentation page found among the top results."""

import re
import typing as t
from urllib.parse import urlsplit

from curl_cffi.requests.exceptions import RequestException
from flask_babel import gettext  # pyright: ignore[reportUnknownVariableType]
from lxml import html
from lxml.etree import ParserError
from markupsafe import escape

from searx import network
from searx.exceptions import SearxEngineResponseException
from searx.result_types import LegacyResult, Result
from searx.results import calculate_score

from . import Plugin, PluginInfo

if t.TYPE_CHECKING:
    from searx.extended_types import SXNG_Request
    from searx.search import SearchWithPlugins
    from . import PluginCfg


MAX_PAGE_BYTES = 750_000
MAX_PREVIEW_CHARS = 480
MAX_TITLE_CHARS = 100
TIMEOUT = 1.5
REPOSITORY_PATH = re.compile(r"^/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$")


def _source(url: str) -> str | None:  # pylint: disable=too-many-return-statements
    if len(url) > 2_048:
        return None
    try:
        parsed = urlsplit(url)
        allowed_authority = not (parsed.username or parsed.password or parsed.port)
    except ValueError:
        return None
    if parsed.scheme != "https" or not allowed_authority:
        return None
    if parsed.hostname == "github.com" and REPOSITORY_PATH.fullmatch(parsed.path):
        return "GitHub"
    if parsed.hostname == "developer.mozilla.org" and re.match(
        r"^/[a-zA-Z-]+/docs/Web/", parsed.path
    ):
        return "MDN"
    if parsed.hostname == "docs.rs" and parsed.path.startswith("/"):
        return "docs.rs"
    return None


def _preview(page: bytes, source: str) -> tuple[str, str] | None:
    try:
        document = html.fromstring(page)
    except (ParserError, ValueError):
        return None

    title_nodes = document.xpath("//main//h1 | //h1")
    title = " ".join(title_nodes[0].text_content().split()) if title_nodes else ""
    if source == "GitHub":
        sections = document.xpath(
            "//article[contains(concat(' ', normalize-space(@class), ' '), ' markdown-body ')]"
        )
    elif source == "MDN":
        sections = document.xpath("//main")
    else:
        sections = document.xpath(
            "//*[contains(concat(' ', normalize-space(@class), ' '), ' docblock ')]"
        )

    paragraphs = (
        t.cast(list[html.HtmlElement], sections[0].xpath(".//p")) if sections else []
    )
    content = " ".join(
        " ".join(node.text_content().split()) for node in paragraphs[:3]
    ).strip()
    if not content:
        descriptions = document.xpath("//meta[@name='description']/@content")
        content = " ".join(descriptions[0].split()) if descriptions else ""
    if not content:
        return None
    if len(content) > MAX_PREVIEW_CHARS:
        content = content[:MAX_PREVIEW_CHARS].rsplit(" ", 1)[0] + "…"
    return title, content


class SXNGPlugin(Plugin):
    """Fetch one known-host page from the highest ranked eligible result."""

    id: str = "result_preview"

    def __init__(self, plg_cfg: "PluginCfg"):
        super().__init__(plg_cfg)
        self.info: PluginInfo = PluginInfo(
            id=self.id,
            name=gettext("Result preview"),
            description=gettext(
                "Show a short preview when a top result is on GitHub, MDN, or docs.rs."
            ),
            preference_section="general",
        )

    def post_search(  # pylint: disable=too-many-return-statements
        self, request: "SXNG_Request", search: "SearchWithPlugins"
    ) -> list[Result | LegacyResult]:
        if search.search_query.pageno != 1 or search.result_container.infoboxes:
            return []
        if (
            request.form.get("format", "html") != "html"
            or "application/json" in request.headers.get("Accept", "").lower()
        ):
            return []

        results = sorted(
            search.result_container.main_results_map.values(),
            key=lambda result: calculate_score(result, result.priority),
            reverse=True,
        )[:8]
        for result in results:
            url = result.url or ""
            source = _source(url)
            if not source:
                continue

            try:
                response = network.get(url, timeout=TIMEOUT, allow_redirects=False)
                response.raise_for_status()
                if response.status_code != 200:
                    return []
                if len(response.content) > MAX_PAGE_BYTES:
                    return []
            except (RequestException, SearxEngineResponseException, ValueError) as exc:
                self.log.debug("Result preview unavailable: %s", exc)
                return []

            preview = _preview(response.content, source)
            if not preview:
                return []
            title, content = preview
            if source == "GitHub":
                title = urlsplit(url).path.strip("/")
            elif not title:
                title = result.title
            title = title[:MAX_TITLE_CHARS]
            return [
                LegacyResult(
                    {
                        "infobox": f"{source}: {title}" if title else source,
                        "id": url,
                        "content": str(escape(content)),
                        "urls": [{"title": gettext("Open page"), "url": url}],
                    }
                )
            ]
        return []
