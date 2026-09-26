# SPDX-License-Identifier: AGPL-3.0-or-later
"""Contract tests for the paid API fallback gate."""

# pylint: disable=missing-class-docstring,invalid-name,protected-access

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


def request_with(serper_key="", brave_key=""):
    values = {"serper_api_key": serper_key, "brave_api_key": brave_key}
    return SimpleNamespace(preferences=SimpleNamespace(get_value=values.get))


class ApiFallbackTest(unittest.TestCase):

    def setUp(self):
        self.plugin = SXNGPlugin(PluginCfg(active=True))
        self.plugin._query_serper = mock.Mock(return_value=[])
        self.plugin._query_brave = mock.Mock(return_value=[])

    def test_plugin_accepts_per_browser_keys_without_instance_keys(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertTrue(self.plugin.init(None))

    def test_no_key_does_not_call_a_provider(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            results = self.plugin.post_search(request_with(), search_with())

        self.assertEqual(results, [])
        self.plugin._query_serper.assert_not_called()
        self.plugin._query_brave.assert_not_called()

    def test_primary_result_does_not_spend_fallback_credit(self):
        results = self.plugin.post_search(request_with("serper", "brave"), search_with(({"google cse"},)))

        self.assertEqual(results, [])
        self.plugin._query_serper.assert_not_called()
        self.plugin._query_brave.assert_not_called()

    def test_unqueried_primary_does_not_trigger_fallback(self):
        results = self.plugin.post_search(
            request_with("serper", "brave"),
            search_with(engines=("duckduckgo",)),
        )

        self.assertEqual(results, [])
        self.plugin._query_serper.assert_not_called()
        self.plugin._query_brave.assert_not_called()

    def test_dogpile_failure_triggers_api_fallback(self):
        self.plugin.post_search(
            request_with("serper", "brave"),
            search_with(engines=("dogpile",)),
        )

        self.plugin._query_serper.assert_called_once_with("site:example.test threat", 1, "serper")
        self.plugin._query_brave.assert_called_once_with("site:example.test threat", 1, "brave")

    def test_browser_serper_key_overrides_instance_key(self):
        self.plugin._query_serper.return_value = [
            {
                "url": "https://example.test/result",
                "title": "Example",
                "content": "Fallback result",
            }
        ]
        with mock.patch.dict(
            os.environ,
            {"SERPER_API_KEY": "instance-serper", "BRAVE_API_KEY": "instance-brave"},
            clear=True,
        ):
            results = self.plugin.post_search(request_with("browser-serper"), search_with())

        self.assertEqual(len(results), 1)
        self.plugin._query_serper.assert_called_once_with("site:example.test threat", 1, "browser-serper")
        self.plugin._query_brave.assert_not_called()

    def test_empty_serper_result_uses_browser_brave_key(self):
        self.plugin._query_brave.return_value = [
            {
                "url": "https://example.test/brave",
                "title": "Brave",
                "content": "Fallback result",
            }
        ]
        with mock.patch.dict(os.environ, {"SERPER_API_KEY": "instance-serper"}, clear=True):
            results = self.plugin.post_search(request_with(brave_key="browser-brave"), search_with())

        self.assertEqual(len(results), 1)
        self.plugin._query_serper.assert_called_once_with("site:example.test threat", 1, "instance-serper")
        self.plugin._query_brave.assert_called_once_with("site:example.test threat", 1, "browser-brave")

    def test_instance_brave_key_is_used_when_browser_key_is_absent(self):
        with mock.patch.dict(os.environ, {"BRAVE_API_KEY": "instance-brave"}, clear=True):
            self.plugin.post_search(request_with(), search_with())

        self.plugin._query_serper.assert_not_called()
        self.plugin._query_brave.assert_called_once_with("site:example.test threat", 1, "instance-brave")

    def test_page_limit_prevents_fallback(self):
        with mock.patch.dict(os.environ, {"SERPER_MAX_PAGE": "2"}, clear=False):
            results = self.plugin.post_search(request_with("serper", "brave"), search_with(pageno=3))

        self.assertEqual(results, [])
        self.plugin._query_serper.assert_not_called()
        self.plugin._query_brave.assert_not_called()


if __name__ == "__main__":
    unittest.main()
