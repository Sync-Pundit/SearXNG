# SPDX-License-Identifier: AGPL-3.0-or-later
"""Right Dao search adapter contract."""

# pylint: disable=missing-class-docstring,invalid-name

import unittest
from types import SimpleNamespace

from lxml import html

from searx.engines import rightdao


class RightDaoTest(unittest.TestCase):

    def test_request_encodes_search_terms(self):
        params = {"url": ""}
        rightdao.request("Johannesburg weather", params)
        self.assertEqual(
            params["url"], "https://rightdao.com/search?q=Johannesburg+weather"
        )

    def test_response_extracts_results_and_ignores_non_web_links(self):
        body = html.fromstring(
            "<main>"
            '<div class="item"><div class="title"><a href="https://example.org/weather">Weather</a></div>'
            '<div class="description">Current conditions.</div></div>'
            '<div class="item"><div class="title"><a href="javascript:alert(1)">Bad</a></div></div>'
            "</main>"
        )
        results = rightdao.response(SimpleNamespace(html=lambda: body))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].url, "https://example.org/weather")
        self.assertEqual(results[0].title, "Weather")
        self.assertEqual(results[0].content, "Current conditions.")
