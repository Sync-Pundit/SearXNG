# SPDX-License-Identifier: AGPL-3.0-or-later
"""Result previews use one known-host request and keep machine search untouched."""

# pylint: disable=missing-class-docstring,invalid-name,protected-access

import unittest
import json
from types import SimpleNamespace
from unittest import mock

from searx.plugins import PluginCfg, result_preview
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


def request_with(format_name="html", accept="text/html", stack_key=""):
    return SimpleNamespace(
        form={"format": format_name},
        headers={
            "Accept": accept,
            "X-Searxng-Internal-Stackexchange-Key": stack_key,
        },
    )


def page(body):
    return SimpleNamespace(
        content=body.encode(), status_code=200, raise_for_status=lambda: None
    )


class ResultPreviewTest(unittest.TestCase):

    def setUp(self):
        self.plugin = SXNGPlugin(PluginCfg(active=True))
        result_preview._STACK_CACHE.clear()
        result_preview._STACK_BACKOFF_UNTIL = 0.0

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
    def test_minecraft_wiki_uses_plaintext_extract(self, get):
        get.return_value = page(
            json.dumps(
                {
                    "query": {
                        "pages": {
                            "1819": {
                                "title": "Redstone Dust",
                                "extract": "Redstone dust powers circuits.",
                            }
                        }
                    }
                }
            )
        )
        url = "https://minecraft.wiki/w/Redstone_Dust"

        cards = self.plugin.post_search(request_with(), search_with(url))

        self.assertEqual(cards[0]["infobox"], "Minecraft Wiki: Redstone Dust")
        self.assertEqual(cards[0]["content"], "Redstone dust powers circuits.")
        self.assertEqual(cards[0]["urls"][0]["url"], url)
        self.assertTrue(
            get.call_args.args[0].startswith("https://minecraft.wiki/api.php?")
        )
        self.assertIn("titles=Redstone_Dust", get.call_args.args[0])

    @mock.patch("searx.plugins.result_preview.curl_requests.get")
    def test_stack_exchange_uses_key_and_caches_accepted_answer(self, get):
        get.return_value = SimpleNamespace(
            status_code=200,
            content=json.dumps(
                {
                    "items": [
                        {"is_accepted": False, "body": "<p>Other answer</p>"},
                        {
                            "is_accepted": True,
                            "body": "<p>Press &lt;Esc&gt; and type :q.</p>",
                        },
                    ],
                    "quota_remaining": 100,
                }
            ).encode(),
        )
        url = "https://stackoverflow.com/questions/11828270/how-do-i-exit-vim"

        first = self.plugin.post_search(
            request_with(stack_key="test-key"), search_with(url)
        )
        second = self.plugin.post_search(
            request_with(stack_key="test-key"), search_with(url)
        )

        self.assertEqual(first[0]["infobox"], "Stack Exchange: Accepted answer")
        self.assertEqual(first[0]["content"], "Press &lt;Esc&gt; and type :q.")
        self.assertEqual(second[0]["content"], first[0]["content"])
        self.assertEqual(first[0]["urls"][0]["url"], url)
        get.assert_called_once()
        self.assertEqual(get.call_args.kwargs["params"]["key"], "test-key")
        self.assertEqual(get.call_args.kwargs["params"]["site"], "stackoverflow")

    @mock.patch("searx.plugins.result_preview.curl_requests.get")
    def test_stack_exchange_skips_missing_key_and_respects_backoff(self, get):
        url = "https://math.stackexchange.com/questions/1234/example"
        self.assertEqual(self.plugin.post_search(request_with(), search_with(url)), [])
        get.assert_not_called()

        get.return_value = SimpleNamespace(
            status_code=200,
            content=b'{"items": [], "backoff": 60}',
        )
        self.assertEqual(
            self.plugin.post_search(
                request_with(stack_key="test-key"), search_with(url)
            ),
            [],
        )
        self.assertEqual(get.call_args.kwargs["params"]["site"], "math")
        self.assertEqual(
            self.plugin.post_search(
                request_with(stack_key="test-key"),
                search_with("https://stackoverflow.com/questions/11828270/example"),
            ),
            [],
        )
        get.assert_called_once()

    @mock.patch("searx.plugins.result_preview.curl_requests.get")
    def test_stack_exchange_key_never_fetches_for_json_search(self, get):
        url = "https://stackoverflow.com/questions/11828270/how-do-i-exit-vim"
        self.assertEqual(
            self.plugin.post_search(
                request_with(format_name="json", stack_key="test-key"),
                search_with(url),
            ),
            [],
        )
        get.assert_not_called()

    @mock.patch("searx.plugins.result_preview.curl_requests.get")
    def test_stack_exchange_key_rejects_spoofed_host_and_non_question_paths(self, get):
        for url in (
            "https://stackoverflow.com.evil.test/questions/1234/example",
            "https://stackoverflow.com/users/1234/example",
            "https://evil.stackexchange.com.evil.test/questions/1234/example",
        ):
            with self.subTest(url=url):
                self.assertEqual(
                    self.plugin.post_search(
                        request_with(stack_key="test-key"), search_with(url)
                    ),
                    [],
                )
        get.assert_not_called()

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
            (request_with(), search_with("https://minecraft.wiki.evil.test/w/Dirt")),
            (request_with(), search_with("https://minecraft.wiki/wiki/Dirt")),
            (
                request_with(),
                search_with("https://evil.stackexchange.com.evil.test/questions/1"),
            ),
            (request_with(), search_with("https://stackoverflow.com/users/1")),
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
