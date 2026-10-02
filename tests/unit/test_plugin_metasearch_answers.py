# SPDX-License-Identifier: AGPL-3.0-or-later
"""Instant answers appear only for explicit queries and valid source data."""

# pylint: disable=missing-class-docstring,invalid-name

import json
import unittest
from types import SimpleNamespace
from unittest import mock

from searx.plugins import PluginCfg
from searx.plugins.color_picker import SXNGPlugin as ColorPicker, parse_color
from searx.plugins.synonym_answer import SXNGPlugin as SynonymAnswer


def search(query, pageno=1):
    return SimpleNamespace(search_query=SimpleNamespace(query=query, pageno=pageno))


def response(payload, status=200):
    return SimpleNamespace(
        content=json.dumps(payload).encode(),
        status_code=status,
        raise_for_status=lambda: None,
    )


class ColorPickerTest(unittest.TestCase):
    def setUp(self):
        self.plugin = ColorPicker(PluginCfg(active=True))

    def test_explicit_color_queries_render_a_picker(self):
        for query, expected in (
            ("color picker", "#ff0000"),
            ("#1a7f64", "#1a7f64"),
            ("color #0f8", "#00ff88"),
            ("rgb(26, 127, 100)", "#1a7f64"),
        ):
            with self.subTest(query=query):
                answers = list(self.plugin.post_search(None, search(query)))
                self.assertEqual(len(answers), 1)
                self.assertEqual(answers[0].answer, expected)
                self.assertEqual(answers[0].template, "answer/color.html")

    def test_ordinary_words_and_invalid_channels_do_not_become_colors(self):
        for query in ("bad", "rgb(256, 0, 0)", "hello #abcdef", "#12345g"):
            with self.subTest(query=query):
                self.assertIsNone(parse_color(query))
                self.assertEqual(list(self.plugin.post_search(None, search(query))), [])
        self.assertEqual(list(self.plugin.post_search(None, search("#1a7f64", 2))), [])


class SynonymAnswerTest(unittest.TestCase):
    def setUp(self):
        self.plugin = SynonymAnswer(PluginCfg(active=True))

    @mock.patch("searx.plugins.synonym_answer.network.get")
    def test_explicit_query_shows_bounded_deduplicated_synonyms_with_source(self, get):
        get.return_value = response(
            [
                {"word": "joyful"},
                {"word": "JOYFUL"},
                {"word": "happy"},
                {"word": "<script>"},
                {"word": "content"},
            ]
        )
        answers = list(self.plugin.post_search(None, search("synonyms for happy")))
        self.assertEqual(len(answers), 1)
        self.assertEqual(answers[0].answer, "Synonyms for happy: joyful, content")
        self.assertEqual(answers[0].url, "https://www.datamuse.com/api/")
        get.assert_called_once_with(
            "https://api.datamuse.com/words?rel_syn=happy&max=8",
            timeout=1.5,
            allow_redirects=False,
        )

    @mock.patch("searx.plugins.synonym_answer.network.get")
    def test_unavailable_source_leaves_ordinary_results_alone(self, get):
        get.return_value = response({"error": "unavailable"})
        self.assertEqual(
            list(self.plugin.post_search(None, search("happy synonyms"))), []
        )
        get.return_value = response([{"word": "joyful"}], status=503)
        self.assertEqual(
            list(self.plugin.post_search(None, search("happy synonyms"))), []
        )
        get.reset_mock()
        self.assertEqual(list(self.plugin.post_search(None, search("happy"))), [])
        self.assertEqual(list(self.plugin.post_search(None, search("happy synonyms", 2))), [])
        get.assert_not_called()
