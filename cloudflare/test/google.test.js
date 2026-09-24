import assert from "node:assert/strict";
import test from "node:test";

import { googleCseEndpoint, googleCseTokenEndpoint } from "../src/google-cse.js";
import { handleRequest } from "../src/index.js";
import { serperEndpoint } from "../src/serper.js";

const TOKEN = "test-spike-token";

function authenticatedRequest(path) {
  return new Request(`https://searxng.example${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
}

function tokenResponse() {
  return new Response('function earlier(){return {"not":"the token"};} google.search.cse.api123({"cse_token":"cse-token","cselibVersion":"v1","exp":["x"]});', {
    status: 200,
    headers: { "Content-Type": "application/javascript" },
  });
}

function cseResponse(results = []) {
  return new Response(`_(${JSON.stringify({ results })});`, {
    status: 200,
    headers: { "Content-Type": "application/javascript" },
  });
}

test("Google CSE preserves the dork and returns compatible results", async () => {
  const calls = [];
  const response = await handleRequest(
    authenticatedRequest('/search?q=site%3Awebflow.io+%22MetaMask%22&format=json&pageno=2&engines=google+cse'),
    { SPIKE_AUTH_TOKEN: TOKEN },
    async (url, init) => {
      calls.push({ init, url: String(url) });
      if (String(url).startsWith(googleCseTokenEndpoint)) return tokenResponse();
      return cseResponse([
        {
          contentNoFormatting: "A Google CSE result",
          titleNoFormatting: "Threat hunt",
          unescapedUrl: "https://example.net/metamask/",
        },
      ]);
    },
  );
  const body = await response.json();
  const searchCall = calls.find((call) => call.url.startsWith(googleCseEndpoint));
  const upstream = new URL(searchCall.url);

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(upstream.searchParams.get("q"), 'site:webflow.io "MetaMask"');
  assert.equal(upstream.searchParams.get("start"), "20");
  assert.equal(upstream.searchParams.get("cse_tok"), "cse-token");
  assert.equal(searchCall.init.headers.Cookie, "CONSENT=YES+");
  assert.deepEqual(body.results, [{
    category: "general",
    content: "A Google CSE result",
    engine: "google cse",
    engines: ["google cse"],
    positions: [1],
    score: 1,
    template: "default.html",
    title: "Threat hunt",
    url: "https://example.net/metamask/",
  }]);
});

test("Serper runs only after a queried Google primary returns no results", async () => {
  const calls = [];
  const response = await handleRequest(
    authenticatedRequest("/search?q=site%3Aexample.com+wallet&format=json&engines=google+cse"),
    { SERPER_API_KEY: "serper-secret", SPIKE_AUTH_TOKEN: TOKEN },
    async (url, init) => {
      calls.push({ body: init.body, headers: init.headers, url: String(url) });
      if (String(url).startsWith(googleCseTokenEndpoint)) return tokenResponse();
      if (String(url).startsWith(googleCseEndpoint)) return cseResponse();
      return Response.json({
        credits: 1,
        organic: [{
          link: "https://fallback.example/result",
          snippet: "Recovered by Serper",
          title: "Fallback result",
        }],
      });
    },
  );
  const body = await response.json();
  const serperCall = calls.find((call) => call.url === serperEndpoint);

  assert.equal(response.status, 200);
  assert.ok(serperCall);
  assert.equal(serperCall.headers["X-API-KEY"], "serper-secret");
  assert.deepEqual(JSON.parse(serperCall.body), {
    num: 10,
    q: "site:example.com wallet",
  });
  assert.deepEqual(body.results, [{
    category: "general",
    content: "Recovered by Serper",
    engine: "plugin: serper_fallback",
    engines: ["plugin: serper_fallback"],
    positions: [1],
    score: 1,
    template: "default.html",
    title: "Fallback result",
    url: "https://fallback.example/result",
  }]);
});

test("Serper does not spend a request when Google CSE returns a result", async () => {
  let serperCalls = 0;
  const response = await handleRequest(
    authenticatedRequest("/search?q=wallet&format=json&engines=google+cse"),
    { SERPER_API_KEY: "serper-secret", SPIKE_AUTH_TOKEN: TOKEN },
    async (url) => {
      if (String(url).startsWith(googleCseTokenEndpoint)) return tokenResponse();
      if (String(url).startsWith(googleCseEndpoint)) {
        return cseResponse([{
          contentNoFormatting: "Primary result",
          titleNoFormatting: "Primary",
          unescapedUrl: "https://primary.example/result",
        }]);
      }
      serperCalls += 1;
      return Response.json({ organic: [] });
    },
  );

  assert.equal(response.status, 200);
  assert.equal(serperCalls, 0);
});

test("a failed Serper fallback does not turn an empty primary result into an error", async () => {
  const response = await handleRequest(
    authenticatedRequest("/search?q=wallet&format=json&engines=google+cse"),
    { SERPER_API_KEY: "serper-secret", SPIKE_AUTH_TOKEN: TOKEN },
    async (url) => {
      if (String(url).startsWith(googleCseTokenEndpoint)) return tokenResponse();
      if (String(url).startsWith(googleCseEndpoint)) return cseResponse();
      return Response.json({ error: "rate limited" }, { status: 429 });
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.results, []);
  assert.deepEqual(body.unresponsive_engines, []);
});
