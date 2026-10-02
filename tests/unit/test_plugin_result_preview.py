# SPDX-License-Identifier: AGPL-3.0-or-later
"""Result previews use one known-host request and keep machine search untouched."""

# pylint: disable=missing-class-docstring,invalid-name

import unittest
from types import SimpleNamespace
from unittest import mock

from searx.plugins import PluginCfg
from searx.plugins.result_preview import SXNGPlugin
from searx.result_types import MainResult
from searx.results import ResultContainer


def search_with(*urls, pageno=1, infoboxes=()):
    container = ResultContainer()
    for url in urls:
        container.extend(
            "google", [MainResult(url=url, title="Result", content="Snippet")]
        )
    container.infoboxes.extend(infoboxes)
    return SimpleNamespace(
        search_query=SimpleNamespace(pageno=pageno),
        result_container=container,
    )


def request_with(format_name="html", accept="text/html"):
    return SimpleNamespace(form={"format": format_name}, headers={"Accept": accept})


def page(body):
    return SimpleNamespace(
        content=body.encode(), status_code=200, raise_for_status=lambda: None
    )


class ResultPreviewTest(unittest.TestCase):

    def setUp(self):
        self.plugin = SXNGPlugin(PluginCfg(active=True))

    @mock.patch("searx.plugins.result_preview.network.get")
    def test_github_result_becomes_infobox(self, get):
        get.return_value = page(
            '<main><h1>SearXNG</h1></main><article class="markdown-body">'
            "<p>A privacy-respecting metasearch engine.</p></article>"
        )
        url = "https://github.com/searxng/searxng"

        cards = self.plugin.post_search(request_with(), search_with(url))

        self.assertEqual(cards[0]["infobox"], "GitHub: searxng/searxng")
        self.assertEqual(cards[0]["content"], "A privacy-respecting metasearch engine.")
        self.assertEqual(cards[0]["urls"][0]["url"], url)
        get.assert_called_once_with(url, timeout=1.5, allow_redirects=False)

    @mock.patch("searx.plugins.result_preview.network.get")
    def test_mdn_and_docs_rs_use_page_body(self, get):
        cases = (
            (
                "https://developer.mozilla.org/en-US/docs/Web/HTTP",
                "<main><h1>HTTP</h1><p>A protocol for the web.</p></main>",
                "MDN: HTTP",
            ),
            (
                "https://docs.rs/serde/latest/serde/",
                '<h1>Serde</h1><div class="docblock"><p>Serialize Rust values.</p></div>',
                "docs.rs: Serde",
            ),
        )
        for url, markup, expected_title in cases:
            with self.subTest(url=url):
                get.reset_mock()
                get.return_value = page(markup)
                cards = self.plugin.post_search(request_with(), search_with(url))
                self.assertEqual(cards[0]["infobox"], expected_title)
                get.assert_called_once()

    @mock.patch("searx.plugins.result_preview.network.get")
    def test_untrusted_text_is_escaped_before_template_marks_it_safe(self, get):
        get.return_value = page(
            "<main><h1>Page</h1><p>&lt;script&gt;alert(1)&lt;/script&gt;</p></main>"
        )

        cards = self.plugin.post_search(
            request_with(),
            search_with("https://developer.mozilla.org/en-US/docs/Web/HTTP"),
        )

        self.assertIn("&lt;script&gt;", cards[0]["content"])
        self.assertNotIn("<script>", cards[0]["content"])

    @mock.patch("searx.plugins.result_preview.network.get")
    def test_no_fetch_for_machine_or_unrelated_search(self, get):
        eligible = search_with("https://github.com/searxng/searxng")
        cases = (
            (request_with("json"), eligible),
            (request_with(accept="application/json"), eligible),
            (request_with(accept="Application/JSON"), eligible),
            (
                request_with(),
                search_with("https://github.com/searxng/searxng", pageno=2),
            ),
            (
                request_with(),
                search_with(
                    "https://github.com/searxng/searxng",
                    infoboxes=({"infobox": "Other"},),
                ),
            ),
            (
                request_with(),
                search_with("https://github.com.evil.test/searxng/searxng"),
            ),
            (request_with(), search_with("https://github.com:bad/searxng/searxng")),
        )
        for request, search in cases:
            with self.subTest(request=request, search=search):
                self.assertEqual(self.plugin.post_search(request, search), [])
        get.assert_not_called()

    @mock.patch("searx.plugins.result_preview.network.get")
    def test_at_most_one_fetch_even_when_page_has_no_preview(self, get):
        get.return_value = page("<html><body>empty</body></html>")
        search = search_with(
            "https://github.com/searxng/searxng",
            "https://docs.rs/serde/latest/serde/",
        )

        self.assertEqual(self.plugin.post_search(request_with(), search), [])
        get.assert_called_once()

    @mock.patch("searx.plugins.result_preview.network.get")
    def test_redirect_or_oversized_page_does_not_add_preview(self, get):
        search = search_with("https://github.com/searxng/searxng")
        get.return_value = page("<h1>Redirect</h1><p>Other site</p>")
        get.return_value.status_code = 302
        self.assertEqual(self.plugin.post_search(request_with(), search), [])

        get.return_value = page("x" * 750_001)
        self.assertEqual(self.plugin.post_search(request_with(), search), [])
