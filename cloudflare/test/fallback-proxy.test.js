import assert from "node:assert/strict";
import test from "node:test";

import { proxyFallbackProvider } from "../src/fallback-proxy.js";

test("Serper requests are forwarded without exposing credentials", async () => {
  let forwarded;
  const response = await proxyFallbackProvider(new Request(
    "http://api-fallback.internal/serper",
    {
      method: "POST",
      headers: { "X-API-KEY": "secret" },
      body: JSON.stringify({ q: "threat intelligence" }),
    },
  ), async (request) => {
    forwarded = request;
    return new Response("ok");
  });

  assert.equal(response.status, 200);
  assert.equal(forwarded.url, "https://google.serper.dev/search");
  assert.equal(forwarded.headers.get("X-API-KEY"), "secret");
  assert.deepEqual(await forwarded.json(), { q: "threat intelligence" });
});

test("Brave query parameters are preserved", async () => {
  let forwarded;
  await proxyFallbackProvider(new Request(
    "http://api-fallback.internal/brave?q=cloudflare&count=10",
    { headers: { "X-Subscription-Token": "secret" } },
  ), async (request) => {
    forwarded = request;
    return new Response("ok");
  });

  assert.equal(
    forwarded.url,
    "https://api.search.brave.com/res/v1/web/search?q=cloudflare&count=10",
  );
  assert.equal(forwarded.headers.get("X-Subscription-Token"), "secret");
});

test("Unknown proxy paths fail closed", async () => {
  const response = await proxyFallbackProvider(new Request(
    "http://api-fallback.internal/unknown",
  ));

  assert.equal(response.status, 404);
});

test("Fallback diagnostics remain inside the Worker", async () => {
  let externalCalls = 0;
  const response = await proxyFallbackProvider(new Request(
    "http://api-fallback.internal/diagnostic",
    { headers: { "X-Fallback-Stage": "post-search" } },
  ), async () => {
    externalCalls += 1;
    return new Response("must not run");
  });

  assert.equal(response.status, 204);
  assert.equal(externalCalls, 0);
});
