import assert from "node:assert/strict";
import test from "node:test";

import { braveEndpoint } from "../src/brave.js";
import { duckDuckGoEndpoint } from "../src/duckduckgo.js";
import { handleRequest } from "../src/index.js";

const TOKEN = "test-spike-token";

const FIRST_PAGE = `
  <html><body>
    <form><input name="vqd" value="page-token"></form>
    <div id="links">
      <div class="result web-result">
        <h2><a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fattacker.github.io%2Fmetamask-login%2F">MetaMask login</a></h2>
        <a class="result__snippet">A MetaMask wallet page</a>
      </div>
      <div class="result web-result">
        <a class="result__snippet">Malformed result without a destination</a>
      </div>
      <div class="result web-result">
        <h2><a href="https://example.com/direct">Direct result</a></h2>
        <a class="result__snippet">Second result</a>
      </div>
    </div>
  </body></html>
`;

const SECOND_PAGE = `
  <html><body><div id="links">
    <div class="result web-result">
      <h2><a href="https://second.example/result">Page two result</a></h2>
      <a class="result__snippet">A later page</a>
    </div>
  </div></body></html>
`;

function authenticatedRequest(path, init = {}) {
  return new Request(`https://searxng.example${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...init.headers,
    },
  });
}

function attributes(markup) {
  return Object.fromEntries(
    [...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
}

function elementFrom(markup, endHandlers = []) {
  const values = attributes(markup);
  return {
    getAttribute(name) {
      return values[name] ?? null;
    },
    onEndTag(handler) {
      endHandlers.push(handler);
    },
  };
}

function textValue(markup) {
  return markup.replace(/<[^>]*>/g, "");
}

class FixtureHTMLRewriter {
  constructor() {
    this.handlers = new Map();
  }

  on(selector, handler) {
    this.handlers.set(selector, handler);
    return this;
  }

  transform(response) {
    return {
      text: async () => {
        const html = await response.text();
        const required = [
          "form#challenge-form",
          'input[name="vqd"]',
          "div#links > div.web-result",
          "div#links > div.web-result h2 a",
          "div#links > div.web-result a.result__snippet",
        ];
        assert.deepEqual([...this.handlers.keys()], required);

        if (/id="challenge-form"/.test(html)) {
          this.handlers.get("form#challenge-form").element();
        }

        const vqd = html.match(/<input[^>]*name="vqd"[^>]*>/i)?.[0];
        if (vqd) {
          this.handlers.get('input[name="vqd"]').element(elementFrom(vqd));
        }

        for (const row of html.matchAll(/<div class="[^"]*web-result[^"]*">([\s\S]*?)<\/div>/gi)) {
          const endHandlers = [];
          this.handlers
            .get("div#links > div.web-result")
            .element(elementFrom(row[0], endHandlers));

          const title = row[1].match(/<h2[^>]*>\s*(<a[^>]*>)([\s\S]*?)<\/a>\s*<\/h2>/i);
          if (title) {
            const handler = this.handlers.get("div#links > div.web-result h2 a");
            handler.element(elementFrom(title[1]));
            handler.text({ text: textValue(title[2]) });
          }

          const snippet = row[1].match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
          if (snippet) {
            this.handlers
              .get("div#links > div.web-result a.result__snippet")
              .text({ text: textValue(snippet[1]) });
          }

          for (const handler of endHandlers) {
            handler();
          }
        }
        return html;
      },
    };
  }
}

const rewriterFactory = () => new FixtureHTMLRewriter();

test("search requires the configured bearer token", async () => {
  const response = await handleRequest(
    new Request("https://searxng.example/search?q=test&format=json"),
    { SPIKE_AUTH_TOKEN: TOKEN },
  );

  assert.equal(response.status, 401);
});

test("search accepts the Threat Hunter dork and returns SearXNG-compatible results", async () => {
  const calls = [];
  const response = await handleRequest(
    authenticatedRequest('/search?q=site%3Agithub.io+%22metamask%22&format=json&pageno=1'),
    { SPIKE_AUTH_TOKEN: TOKEN },
    async (url, init) => {
      calls.push({ body: String(init.body), method: init.method, url });
      return new Response(FIRST_PAGE, { status: 200 });
    },
    rewriterFactory,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{
    body: "kl=wt-wt&q=site%3Agithub.io+%22metamask%22&b=",
    method: "POST",
    url: duckDuckGoEndpoint,
  }]);
  assert.equal(body.query, 'site:github.io "metamask"');
  assert.equal(body.results.length, 2);
  assert.deepEqual(body.results[0], {
    category: "general",
    content: "A MetaMask wallet page",
    engine: "duckduckgo",
    engines: ["duckduckgo"],
    positions: [1],
    score: 1,
    template: "default.html",
    title: "MetaMask login",
    url: "https://attacker.github.io/metamask-login/",
  });
  assert.equal(body.results[1].score, 0.5);
  assert.deepEqual(body.unresponsive_engines, []);
});

test("page two uses the continuation token without exposing upstream controls", async () => {
  const calls = [];
  const response = await handleRequest(
    authenticatedRequest(
      "/search?q=wallet&format=json&pageno=2&engines=duckduckgo&url=https%3A%2F%2F127.0.0.1",
    ),
    { SPIKE_AUTH_TOKEN: TOKEN },
    async (url, init) => {
      calls.push({ body: String(init.body), url });
      return new Response(calls.length === 1 ? FIRST_PAGE : SECOND_PAGE, { status: 200 });
    },
    rewriterFactory,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, duckDuckGoEndpoint);
  assert.equal(calls[1].url, duckDuckGoEndpoint);
  assert.equal(new URLSearchParams(calls[1].body).get("vqd"), "page-token");
  assert.equal(new URLSearchParams(calls[1].body).get("s"), "10");
  assert.equal(body.results[0].url, "https://second.example/result");
});

test("search rejects inputs outside the retained contract before fetching", async () => {
  const cases = [
    ["/search?format=json", 400],
    ["/search?q=test&format=html", 406],
    ["/search?q=test&format=json&pageno=0", 400],
    ["/search?q=test&format=json&engines=private", 400],
    ["/search?q=test&format=json&engines=braveapi&pageno=11", 400],
    [`/search?q=${"x".repeat(500)}&format=json`, 400],
  ];

  for (const [path, expectedStatus] of cases) {
    let fetchCalls = 0;
    const response = await handleRequest(
      authenticatedRequest(path),
      { SPIKE_AUTH_TOKEN: TOKEN },
      async () => {
        fetchCalls += 1;
        return new Response(FIRST_PAGE);
      },
      rewriterFactory,
    );
    assert.equal(response.status, expectedStatus, path);
    assert.equal(fetchCalls, 0, path);
  }
});

test("Brave API preserves dorks and uses its page-index offset", async () => {
  const calls = [];
  const response = await handleRequest(
    authenticatedRequest(
      '/search?q=site%3Awebflow.io+%22MetaMask%22&format=json&pageno=2&engines=braveapi',
    ),
    { BRAVE_API_KEY: "brave-secret", SPIKE_AUTH_TOKEN: TOKEN },
    async (url, init) => {
      calls.push({
        accept: init.headers.Accept,
        method: init.method,
        redirect: init.redirect,
        token: init.headers["X-Subscription-Token"],
        url: String(url),
      });
      return Response.json({
        web: {
          results: [
            {
              age: "July 25, 2026",
              description: "A <strong>MetaMask</strong> &amp; wallet page",
              title: "Threat &lt;hunt&gt;",
              url: "https://example.github.io/metamask/",
            },
            {
              description: "Duplicate",
              title: "Duplicate",
              url: "https://example.github.io/metamask/",
            },
            { title: "Unsafe", url: "javascript:alert(1)" },
          ],
        },
      });
    },
  );
  const body = await response.json();
  const upstream = new URL(calls[0].url);

  assert.equal(response.status, 200);
  assert.equal(upstream.origin + upstream.pathname, braveEndpoint);
  assert.equal(upstream.searchParams.get("q"), 'site:webflow.io "MetaMask"');
  assert.equal(upstream.searchParams.get("count"), "20");
  assert.equal(upstream.searchParams.get("offset"), "1");
  assert.equal(upstream.searchParams.get("text_decorations"), "false");
  assert.deepEqual(calls[0], {
    accept: "application/json",
    method: "GET",
    redirect: "error",
    token: "brave-secret",
    url: calls[0].url,
  });
  assert.equal(body.results.length, 1);
  assert.deepEqual(body.results[0], {
    category: "general",
    content: "A MetaMask & wallet page",
    engine: "braveapi",
    engines: ["braveapi"],
    positions: [1],
    publishedDate: "July 25, 2026",
    score: 1,
    template: "default.html",
    title: "Threat <hunt>",
    url: "https://example.github.io/metamask/",
  });
});

test("Brave API requires its server-side secret before network access", async () => {
  let fetchCalls = 0;
  const response = await handleRequest(
    authenticatedRequest("/search?q=test&format=json&engines=braveapi"),
    { SPIKE_AUTH_TOKEN: TOKEN },
    async () => {
      fetchCalls += 1;
      return Response.json({});
    },
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(fetchCalls, 0);
  assert.deepEqual(body.unresponsive_engines, [["braveapi", "not configured"]]);
});

test("Brave rate limits are unavailable rather than empty successful searches", async () => {
  const response = await handleRequest(
    authenticatedRequest("/search?q=test&format=json&engines=braveapi"),
    { BRAVE_API_KEY: "brave-secret", SPIKE_AUTH_TOKEN: TOKEN },
    async () => Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 }),
  );
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.deepEqual(body.results, []);
  assert.deepEqual(body.unresponsive_engines, [["braveapi", "rate limited"]]);
});

test("search accepts only GET", async () => {
  const response = await handleRequest(
    authenticatedRequest("/search?q=test&format=json", { method: "POST" }),
    { SPIKE_AUTH_TOKEN: TOKEN },
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET");
});

test("a provider CAPTCHA is unavailable rather than an empty successful search", async () => {
  const response = await handleRequest(
    authenticatedRequest("/search?q=test&format=json"),
    { SPIKE_AUTH_TOKEN: TOKEN },
    async () => new Response('<form id="challenge-form"></form>', { status: 200 }),
    rewriterFactory,
  );
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.error, "Search provider unavailable");
  assert.deepEqual(body.results, []);
  assert.deepEqual(body.unresponsive_engines, [["duckduckgo", "CAPTCHA"]]);
});
