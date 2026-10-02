# SPDX-License-Identifier: AGPL-3.0-or-later
"""Show a short English synonym answer from Datamuse."""

import json
import re
import typing as t
from urllib.parse import urlencode

from curl_cffi.requests.exceptions import RequestException
from flask_babel import gettext

from searx import network
from searx.exceptions import SearxEngineResponseException
from searx.plugins import Plugin, PluginInfo
from searx.result_types import EngineResults

if t.TYPE_CHECKING:
    from searx.extended_types import SXNG_Request
    from searx.search import SearchWithPlugins
    from searx.plugins import PluginCfg


SYNONYM_QUERY = re.compile(
    r"^(?:synonyms? for ([a-z][a-z'-]{1,39})|([a-z][a-z'-]{1,39}) synonyms?)$",
    re.I,
)
SYNONYM_WORD = re.compile(r"[a-z][a-z' -]{0,59}", re.I)
SOURCE_URL = "https://www.datamuse.com/api/"


def _synonyms(payload: object, word: str) -> list[str]:
    if not isinstance(payload, list):
        return []
    seen = {word.casefold()}
    synonyms = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        candidate = item.get("word")
        if not isinstance(candidate, str) or not SYNONYM_WORD.fullmatch(candidate):
            continue
        normalized = candidate.casefold()
        if normalized not in seen:
            seen.add(normalized)
            synonyms.append(candidate)
        if len(synonyms) == 8:
            break
    return synonyms


class SXNGPlugin(Plugin):
    """Fetch synonyms only for an explicit English single-word query."""

    id = "synonym_answer"

    def __init__(self, plg_cfg: "PluginCfg") -> None:
        super().__init__(plg_cfg)
        self.info = PluginInfo(
            id=self.id,
            name=gettext("English synonyms"),
            description=gettext("Show related words for an explicit English synonym query."),
            examples=["synonyms for happy", "happy synonyms"],
            preference_section="query",
        )

    def post_search(self, request: "SXNG_Request", search: "SearchWithPlugins") -> EngineResults:
        results = EngineResults()
        if search.search_query.pageno != 1:
            return results
        match = SYNONYM_QUERY.fullmatch(search.search_query.query.strip())
        if not match:
            return results
        word = (match[1] or match[2]).lower()
        url = "https://api.datamuse.com/words?" + urlencode({"rel_syn": word, "max": 8})
        try:
            response = network.get(url, timeout=1.5, allow_redirects=False)
            response.raise_for_status()
            if response.status_code != 200 or len(response.content) > 32_000:
                return results
            words = _synonyms(json.loads(response.content), word)
        except (RequestException, SearxEngineResponseException, ValueError) as exc:
            self.log.debug("Synonym answer unavailable: %s", exc)
            return results
        if words:
            results.add(
                results.types.Answer(
                    answer=f"Synonyms for {word}: {', '.join(words)}",
                    url=SOURCE_URL,
                )
            )
        return results
