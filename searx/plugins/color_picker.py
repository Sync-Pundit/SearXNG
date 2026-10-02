# SPDX-License-Identifier: AGPL-3.0-or-later
"""Show a native color picker for an explicit color query."""

import re
import typing as t

from flask_babel import gettext

from searx.plugins import Plugin, PluginInfo
from searx.result_types import EngineResults

if t.TYPE_CHECKING:
    from searx.extended_types import SXNG_Request
    from searx.search import SearchWithPlugins
    from searx.plugins import PluginCfg


HEX_COLOR = re.compile(r"^(?:color\s+)?(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", re.I)
RGB_COLOR = re.compile(r"^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$", re.I)


def parse_color(query: str) -> str | None:
    query = query.strip()
    if query.lower() == "color picker":
        return "#ff0000"
    match = HEX_COLOR.fullmatch(query)
    if match:
        value = match[1].lstrip("#").lower()
        if len(value) == 3:
            value = "".join(channel * 2 for channel in value)
        return f"#{value}"
    match = RGB_COLOR.fullmatch(query)
    if match:
        channels = tuple(int(value) for value in match.groups())
        if all(value <= 255 for value in channels):
            return "#" + "".join(f"{value:02x}" for value in channels)
    return None


class SXNGPlugin(Plugin):
    """Render a browser-native picker without contacting a provider."""

    id = "color_picker"

    def __init__(self, plg_cfg: "PluginCfg") -> None:
        super().__init__(plg_cfg)
        self.info = PluginInfo(
            id=self.id,
            name=gettext("Color picker"),
            description=gettext("Pick a color from a hex or RGB search."),
            examples=["color picker", "#1a7f64", "rgb(26, 127, 100)"],
            preference_section="query",
        )

    def post_search(self, request: "SXNG_Request", search: "SearchWithPlugins") -> EngineResults:
        results = EngineResults()
        if search.search_query.pageno != 1:
            return results
        value = parse_color(search.search_query.query)
        if value:
            results.add(results.types.Answer(answer=value, template="answer/color.html"))
        return results
