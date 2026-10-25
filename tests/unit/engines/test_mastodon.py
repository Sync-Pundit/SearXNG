# SPDX-License-Identifier: AGPL-3.0-or-later
"""Mastodon account notes must enter the result pipeline as readable text."""
import unittest
from unittest import mock

from searx.engines import mastodon


class MastodonTest(unittest.TestCase):
    def account(self, note):
        return {
            'uri': 'https://example.org/users/researcher',
            'username': 'researcher',
            'followers_count': 1165,
            'note': note,
            'avatar': 'https://example.org/avatar.png',
            'created_at': '2026-03-23T00:00:00.000Z',
        }

    def test_account_bio_extracts_text_with_paragraph_and_line_boundaries(self):
        response = mock.Mock()
        response.json.return_value = {'accounts': [self.account(
            '<p>Healthcare data scientist.<br>Grain farmer.</p>'
            '<p>Canadian living in <a href="https://example.org/tags/Alberta">'
            '#<span>Alberta</span></a>.</p>'
        )]}
        with mock.patch.object(mastodon, 'mastodon_type', 'accounts'):
            result = mastodon.response(response)[0]
        self.assertEqual(result['content'], 'Healthcare data scientist. Grain farmer. Canadian living in #Alberta.')
        self.assertEqual(result['title'], 'researcher (1165 followers)')
        self.assertEqual(result['thumbnail'], 'https://example.org/avatar.png')
        self.assertEqual(result['publishedDate'].year, 2026)

    def test_account_bio_omits_active_markup_and_accepts_empty_notes(self):
        response = mock.Mock()
        response.json.return_value = {'accounts': [
            self.account('<p>Research &amp; writing</p><script>unsafe()</script><style>body{display:none}</style>'),
            self.account(''),
        ]}
        with mock.patch.object(mastodon, 'mastodon_type', 'accounts'):
            results = mastodon.response(response)
        self.assertEqual(results[0]['content'], 'Research & writing')
        self.assertEqual(results[1]['content'], '')

    def test_hashtag_results_keep_usage_counts(self):
        response = mock.Mock()
        response.json.return_value = {'hashtags': [{
            'url': 'https://example.org/tags/research', 'name': 'research',
            'history': [{'uses': '3', 'accounts': '2'}, {'uses': '4', 'accounts': '3'}],
        }]}
        with mock.patch.object(mastodon, 'mastodon_type', 'hashtags'):
            result = mastodon.response(response)[0]
        self.assertEqual(result['content'], 'Hashtag has been used 7 times by 5 different users')
