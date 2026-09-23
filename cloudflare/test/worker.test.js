import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../src/index.js";

const TOKEN = "test-spike-token";

function request(path, init = {}) {
  return new Request(`https://searxng.example${path}`, init);
}

function authenticatedBody(body) {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

test("health endpoint reports the worker", async () => {
  const response = await handleRequest(request("/healthz"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, worker: "searxng" });
});

test("root serves the browser search console with a nonce-bound policy", async () => {
  const response = await handleRequest(request("/"));
  const body = await response.text();
  const policy = response.headers.get("Content-Security-Policy");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /^text\/html/);
  assert.match(body, /<section class="panel search-panel" id="search-form" role="search">/);
  assert.match(body, /id="token"[^>]*type="password"/);
  assert.match(body, /id="query"[^>]*maxlength="499"/);
  assert.match(body, /fetch\(url/);
  assert.match(policy, /default-src 'none'/);
  const nonce = body.match(/<script nonce="([a-f0-9]+)">/)?.[1];
  assert.ok(nonce);
  assert.match(policy, new RegExp(`script-src 'nonce-${nonce}'`));
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
});

test("compatibility catalog exposes only fixed probes", async () => {
  const response = await handleRequest(request("/compat"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.probes.map((probe) => probe.name),
    ["example-html", "github-json", "redirect-chain", "duckduckgo-html"],
  );
  assert.equal(body.probes.some((probe) => "url" in probe), false);
});

test("probe execution stays disabled until its secret exists", async () => {
  const response = await handleRequest(
    request("/compat/run", authenticatedBody({ probes: ["example-html"] })),
  );

  assert.equal(response.status, 503);
});

test("probe execution requires the configured bearer token", async () => {
  const response = await handleRequest(
    request("/compat/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probes: ["example-html"] }),
    }),
    { SPIKE_AUTH_TOKEN: TOKEN },
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("WWW-Authenticate"), "Bearer");
});

test("request body cannot inject a URL or query", async () => {
  let fetchCalls = 0;
  const response = await handleRequest(
    request(
      "/compat/run",
      authenticatedBody({ probes: ["example-html"], url: "https://internal.example" }),
    ),
    { SPIKE_AUTH_TOKEN: TOKEN },
    async () => {
      fetchCalls += 1;
      return new Response("unexpected");
    },
  );

  assert.equal(response.status, 400);
  assert.equal(fetchCalls, 0);
});

test("unknown probe names are rejected before network access", async () => {
  let fetchCalls = 0;
  const response = await handleRequest(
    request("/compat/run", authenticatedBody({ probes: ["https://example.com/"] })),
    { SPIKE_AUTH_TOKEN: TOKEN },
    async () => {
      fetchCalls += 1;
      return new Response("unexpected");
    },
  );

  assert.equal(response.status, 400);
  assert.equal(fetchCalls, 0);
});

test("an authenticated fixed probe runs through the fetch seam", async () => {
  const calls = [];
  const response = await handleRequest(
    request("/compat/run", authenticatedBody({ probes: ["example-html"] })),
    { SPIKE_AUTH_TOKEN: TOKEN },
    async (url, init) => {
      calls.push({ url, method: init.method });
      return new Response("<html><title>Example</title></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ url: "https://example.com/", method: "GET" }]);
  assert.equal(body.results[0].name, "example-html");
  assert.equal(body.results[0].ok, true);
  assert.equal(body.results[0].status, 200);
  assert.equal(body.results[0].sampledBytes, 35);
  assert.match(body.results[0].sampleSha256, /^[a-f0-9]{64}$/);
});

test("probe execution accepts only POST", async () => {
  const response = await handleRequest(request("/compat/run"), { SPIKE_AUTH_TOKEN: TOKEN });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "POST");
});
