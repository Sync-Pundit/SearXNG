# SPDX-License-Identifier: AGPL-3.0-or-later
"""Regression tests for the Brave Search API adapter."""

import os
import unittest
from collections import defaultdict
from unittest import mock

from searx.engines import braveapi


class BraveApiTest(unittest.TestCase):

    def tearDown(self):
        braveapi.api_key = ""

    def test_setup_reads_container_secret(self):
        with mock.patch.dict(os.environ, {"BRAVE_API_KEY": "container-secret"}, clear=False):
            braveapi.setup({})

        self.assertEqual(braveapi.api_key, "container-secret")

    def test_request_uses_page_index_and_api_headers(self):
        braveapi.api_key = "secret"
        params = defaultdict(dict)
        params.update({"pageno": 2, "time_range": "week", "safesearch": 1})

        braveapi.request("example query", params)

        self.assertIn("offset=1", params["url"])
        self.assertIn("time_range=past_week", params["url"])
        self.assertEqual(params["headers"]["X-Subscription-Token"], "secret")
        self.assertEqual(params["headers"]["Accept"], "application/json")

    def test_response_returns_web_result_not_video_result(self):
        response = mock.Mock()
        response.json.return_value = {
            "web": {
                "results": [
                    {
                        "url": "https://example.test/result",
                        "title": "<strong>Example</strong>",
                        "description": "A <em>web</em> result",
                        "age": "2026-09-24T12:00:00Z",
                        "thumbnail": {"src": "https://example.test/thumb.png", "logo": False},
                    }
                ]
            }
        }

        results = braveapi.response(response)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].template, "default.html")
        self.assertEqual(results[0].url, "https://example.test/result")
        self.assertEqual(results[0].title, "Example")
        self.assertEqual(results[0].content, "A web result")
        self.assertEqual(results[0].thumbnail, "https://example.test/thumb.png")
        self.assertIsNotNone(results[0].publishedDate)


if __name__ == "__main__":
    unittest.main()
