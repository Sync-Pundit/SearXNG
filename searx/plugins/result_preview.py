# SPDX-License-Identifier: AGPL-3.0-or-later
"""Show a short preview of a documentation page found among the top results."""

import json
import os
import re
import threading
import time
import typing as t
from urllib.parse import unquote, urlencode, urlsplit

from curl_cffi import requests as curl_requests
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
STACK_QUESTION_PATH = re.compile(r"^/questions/[0-9]+(?:/[^/?#]+)?/?$")
STACK_HOST = re.compile(r"^[A-Za-z0-9-]+\.stackexchange\.com$")
STACK_KEY_HEADER = "X-Searxng-Internal-Stackexchange-Key"
_STACK_LOCK = threading.Lock()
_STACK_CACHE: dict[str, tuple[float, tuple[str, str] | None]] = {}
_STACK_BACKOFF_UNTIL = 0.0


def _remember_stack(url: str, now: float, preview: tuple[str, str] | None) -> None:
    if len(_STACK_CACHE) >= 128:
        _STACK_CACHE.clear()
    _STACK_CACHE[url] = (now + 60, preview)


def _stack_payload(
    endpoint: str, params: dict[str, str | int]
) -> dict[str, object] | None:
    try:
        response = curl_requests.get(
            endpoint,
            params=params,
            headers={"User-Agent": "SearXNG result preview"},
            timeout=TIMEOUT,
            allow_redirects=False,
        )
        if response.status_code != 200 or len(response.content) > MAX_PAGE_BYTES:
            return None
        payload = json.loads(response.content)
    except (RequestException, ValueError):
        return None
    return t.cast(dict[str, object], payload) if isinstance(payload, dict) else None


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
    if parsed.hostname == "minecraft.wiki" and parsed.path.startswith("/w/"):
        return "Minecraft Wiki"
    if parsed.hostname in {"stackoverflow.com", "serverfault.com", "superuser.com"} or (
        parsed.hostname and STACK_HOST.fullmatch(parsed.hostname)
    ):
        if STACK_QUESTION_PATH.fullmatch(parsed.path):
            return "Stack Exchange"
    return None


def _fetch_url(url: str, source: str) -> str:
    parsed = urlsplit(url)
    if source == "Minecraft Wiki":
        title = unquote(parsed.path.removeprefix("/w/"))
        query = urlencode(
            {
                "action": "query",
                "format": "json",
                "prop": "extracts",
                "exintro": "1",
                "explaintext": "1",
                "titles": title,
            }
        )
        return f"https://minecraft.wiki/api.php?{query}"
    return url


def _minecraft_preview(page: bytes) -> tuple[str, str] | None:
    try:
        payload = json.loads(page)
        article = next(iter(payload["query"]["pages"].values()))
        title, content = article["title"], article["extract"]
    except (KeyError, StopIteration, TypeError, ValueError):
        return None
    if not isinstance(title, str) or not isinstance(content, str):
        return None
    content = " ".join(content.split())
    if not content:
        return None
    if len(content) > MAX_PREVIEW_CHARS:
        content = content[:MAX_PREVIEW_CHARS].rsplit(" ", 1)[0] + "…"
    return title, content


# pylint: disable-next=too-many-return-statements,too-many-branches
def _stack_preview(url: str, key: str) -> tuple[str, str] | None:
    """Cache API answers and honor backoff before another request in this process."""
    global _STACK_BACKOFF_UNTIL  # pylint: disable=global-statement

    parsed = urlsplit(url)
    question_id = parsed.path.split("/")[2]
    host = parsed.hostname or ""
    site = host.removesuffix(".com").removesuffix(".stackexchange")
    endpoint = f"https://api.stackexchange.com/2.3/questions/{question_id}/answers"
    params: dict[str, str | int] = {"site": site, "filter": "withbody", "pagesize": 100}
    if key:
        params["key"] = key

    with _STACK_LOCK:
        now = time.monotonic()
        cached = _STACK_CACHE.get(url)
        if cached and cached[0] > now:
            return cached[1]
        if now < _STACK_BACKOFF_UNTIL:
            return None
        payload = _stack_payload(endpoint, params)
        if payload is None:
            _remember_stack(url, now, None)
            return None

        backoff = payload.get("backoff")
        if isinstance(backoff, int) and backoff > 0:
            _STACK_BACKOFF_UNTIL = now + backoff
        if payload.get("quota_remaining") == 0:
            _STACK_BACKOFF_UNTIL = max(_STACK_BACKOFF_UNTIL, now + 3600)

        raw_items = payload.get("items", [])
        if not isinstance(raw_items, list):
            _remember_stack(url, now, None)
            return None
        items = t.cast(list[object], raw_items)
        answer: dict[str, object] | None = None
        for item in items:
            if isinstance(item, dict):
                candidate = t.cast(dict[str, object], item)
                if candidate.get("is_accepted") is True:
                    answer = candidate
                    break
        preview = None
        body = answer.get("body") if answer else None
        if isinstance(body, str):
            try:
                content = " ".join(html.fromstring(body).text_content().split())
            except (ParserError, ValueError):
                content = ""
            if content:
                if len(content) > MAX_PREVIEW_CHARS:
                    content = content[:MAX_PREVIEW_CHARS].rsplit(" ", 1)[0] + "…"
                preview = ("Accepted answer", content)
        _remember_stack(url, now, preview)
        return preview


def _preview(page: bytes, source: str) -> tuple[str, str] | None:
    try:
        document = html.fromstring(page)
    except (ParserError, ValueError):
        return None

    title_nodes = document.xpath("//*[@id='firstHeading'] | //main//h1 | //h1")
    title = (
        " ".join(" ".join(title_nodes[0].xpath(".//text()[not(ancestor::button)]")).split())
        if title_nodes
        else ""
    )
    if source == "GitHub":
        sections = document.xpath(
            "//article[contains(concat(' ', normalize-space(@class), ' '), ' markdown-body ')]"
        )
    elif source == "MDN":
        sections = document.xpath("//main")
    elif source == "docs.rs":
        sections = document.xpath(
            "//*[contains(concat(' ', normalize-space(@class), ' '), ' docblock ')]"
        )
    else:
        return None

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
                "Show a short preview for supported documentation and Q&A results."
            ),
            preference_section="general",
        )

    def _page_preview(self, url: str, source: str) -> tuple[str, str] | None:
        try:
            options: dict[str, t.Any] = {
                "timeout": TIMEOUT,
                "allow_redirects": False,
            }
            if source == "Minecraft Wiki":
                options["headers"] = {"User-Agent": "SearXNG result preview"}
            response = network.get(_fetch_url(url, source), **options)
            response.raise_for_status()
            if response.status_code != 200 or len(response.content) > MAX_PAGE_BYTES:
                return None
        except (RequestException, SearxEngineResponseException, ValueError) as exc:
            self.log.debug("Result preview unavailable: %s", exc)
            return None

        if source == "Minecraft Wiki":
            return _minecraft_preview(response.content)
        return _preview(response.content, source)

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

            if source == "Stack Exchange":
                key = request.headers.get(STACK_KEY_HEADER) or os.environ.get(
                    "STACKEXCHANGE_API_KEY", ""
                )
                if not key:
                    continue
                preview = _stack_preview(url, key)
            else:
                preview = self._page_preview(url, source)
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
