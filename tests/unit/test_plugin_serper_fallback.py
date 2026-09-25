# SPDX-License-Identifier: AGPL-3.0-or-later
"""Contract tests for the paid Serper fallback gate."""

import os
import unittest
from types import SimpleNamespace
from unittest import mock

from searx.plugins import PluginCfg
from searx.plugins.serper_fallback import SXNGPlugin


def search_with(primary_results=(), pageno=1, engines=("google cse",)):
    results = {index: SimpleNamespace(engines=set(provenance)) for index, provenance in enumerate(primary_results)}
    return SimpleNamespace(
        search_query=SimpleNamespace(
            query="site:example.test threat",
            pageno=pageno,
            engineref_list=[SimpleNamespace(name=name) for name in engines],
        ),
        result_container=SimpleNamespace(main_results_map=results),
    )


class SerperFallbackTest(unittest.TestCase):

    def setUp(self):
        self.plugin = SXNGPlugin(PluginCfg(active=True))

    def test_disabled_without_key(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(self.plugin.init(None))

    def test_primary_result_does_not_spend_fallback_credit(self):
        self.plugin._query_serper = mock.Mock(return_value=[])

        results = self.plugin.post_search(None, search_with(({"google cse"},)))

        self.assertEqual(results, [])
        self.plugin._query_serper.assert_not_called()

    def test_unqueried_primary_does_not_trigger_fallback(self):
        self.plugin._query_serper = mock.Mock(return_value=[])

        results = self.plugin.post_search(None, search_with(engines=("duckduckgo",)))

        self.assertEqual(results, [])
        self.plugin._query_serper.assert_not_called()

    def test_empty_queried_primary_uses_fallback(self):
        self.plugin._query_serper = mock.Mock(
            return_value=[
                {
                    "url": "https://example.test/result",
                    "title": "Example",
                    "content": "Fallback result",
                }
            ]
        )

        results = self.plugin.post_search(None, search_with())

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].url, "https://example.test/result")
        self.plugin._query_serper.assert_called_once_with("site:example.test threat", 1)

    def test_page_limit_prevents_fallback(self):
        self.plugin._query_serper = mock.Mock(return_value=[])
        with mock.patch.dict(os.environ, {"SERPER_MAX_PAGE": "2"}, clear=False):
            results = self.plugin.post_search(None, search_with(pageno=3))

        self.assertEqual(results, [])
        self.plugin._query_serper.assert_not_called()


if __name__ == "__main__":
    unittest.main()
