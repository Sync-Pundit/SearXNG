# SPDX-License-Identifier: AGPL-3.0-or-later
"""Regression tests for Yahoo's regional YBV cookie handling."""

# pylint: disable=protected-access

import logging
import unittest
from collections import defaultdict
from types import SimpleNamespace
from unittest import mock

from searx.engines import yahoo


class YahooTest(unittest.TestCase):
    """Exercise Yahoo request recovery without making provider requests."""

    def setUp(self):
        self.cache = mock.Mock()
        yahoo.CACHE = self.cache
        yahoo.logger = logging.getLogger("test_yahoo")

    def test_regional_ybv_cache(self):
        self.cache.get.side_effect = {
            "YBV:uk.search.yahoo.com": "v0.2-uk-cookie",
            "YBV:search.yahoo.com": "v0.2-global-cookie",
        }.get
        params = defaultdict(dict)
        params.update(
            {
                "searxng_locale": "en-GB",
                "time_range": None,
                "pageno": 1,
                "safesearch": 1,
            }
        )

        yahoo.request("cloudflare", params)

        self.assertEqual(params["cookies"]["YBV"], "v0.2-uk-cookie")
        self.assertNotEqual(params["cookies"]["YBV"], "v0.2-global-cookie")
        self.assertFalse(params["raise_for_httperror"])

    @mock.patch("searx.engines.yahoo.get")
    def test_empty_response_retry(self, get):
        params = {"cookies": {}, "headers": {"Accept": "text/html"}}
        initial = SimpleNamespace(
            status_code=200,
            content=b"",
            url="https://uk.search.yahoo.com/search?p=cloudflare",
            cookies={},
            headers={},
            search_params=params,
        )
        recovered = SimpleNamespace(
            status_code=200,
            content=b"<html>results</html>",
            url=initial.url,
            cookies={"YBV": "v0.2-fresh-cookie"},
            headers={},
        )
        get.return_value = recovered

        result = yahoo._yahoo_html(initial)

        self.assertIs(result, recovered)
        get.assert_called_once_with(
            initial.url,
            cookies={},
            headers={"Accept": "text/html", "Cache-Control": "no-cache"},
            allow_redirects=False,
            raise_for_httperror=False,
        )

    @mock.patch("searx.engines.yahoo.get")
    def test_provider_error_is_not_retried(self, get):
        params = {"cookies": {}, "headers": {}}
        failed = SimpleNamespace(
            status_code=500,
            content=b"",
            url="https://uk.search.yahoo.com/search?p=cloudflare",
            cookies={},
            headers={},
            search_params=params,
        )

        result = yahoo._yahoo_html(failed)

        self.assertIs(result, failed)
        get.assert_not_called()

    @mock.patch("searx.engines.yahoo.get")
    def test_cross_region_cookie(self, get):
        self.cache.get.return_value = None
        params = {"cookies": {"YBV": "v0.2-uk-cookie"}, "headers": {}}
        initial = SimpleNamespace(
            status_code=307,
            content=b"",
            url="https://uk.search.yahoo.com/search?p=cloudflare",
            cookies={"YBV": "v0.2-uk-cookie"},
            headers={"location": "https://search.yahoo.com/search?p=cloudflare"},
            search_params=params,
        )
        recovered = SimpleNamespace(
            status_code=200,
            content=b"<html>results</html>",
            url="https://search.yahoo.com/search?p=cloudflare",
            cookies={},
            headers={},
        )
        get.return_value = recovered

        result = yahoo._yahoo_html(initial)

        self.assertIs(result, recovered)
        self.assertNotIn("YBV", get.call_args.kwargs["cookies"])
        self.cache.set.assert_called_once_with("YBV:uk.search.yahoo.com", "v0.2-uk-cookie", expire=86400)


if __name__ == "__main__":
    unittest.main()
