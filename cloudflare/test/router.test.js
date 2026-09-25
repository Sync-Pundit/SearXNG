import assert from "node:assert/strict";
import test from "node:test";

import { internals, routeRequest } from "../src/router.js";

const TOKEN = "test-machine-token";

function request(path, init = {}) {
  return new Request(`https://searxng.example${path}`, init);
}

function fakeContainer(response = new Response("upstream", {
  headers: { "Content-Type": "text/html; charset=utf-8" },
})) {
  const calls = [];
  return {
    calls,
    factory() {
      return {
        async fetch(value) {
          calls.push(value);
          return response;
        },
      };
    },
  };
}

test("health does not start the container", async () => {
  let factoryCalls = 0;
  const response = await routeRequest(request("/healthz"), {}, () => {
    factoryCalls += 1;
    throw new Error("must not run");
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    runtime: "cloudflare-container",
    worker: "searxng",
  });
  assert.equal(factoryCalls, 0);
});

test("browser routes are public and proxied unchanged", async () => {
  for (const path of ["/", "/preferences", "/stats", "/search?q=threat+hunting"]) {
    const container = fakeContainer();
    const response = await routeRequest(request(path), {}, container.factory);

    assert.equal(response.status, 200, path);
    assert.equal(container.calls.length, 1, path);
    assert.equal(new URL(container.calls[0].url).pathname, new URL(request(path).url).pathname);
    assert.match(response.headers.get("Server-Timing"), /^edge;dur=/);
  }
});

test("JSON search requires a configured bearer token", async () => {
  const container = fakeContainer();
  const missingSecret = await routeRequest(
    request("/search?q=test&format=json"),
    {},
    container.factory,
  );
  assert.equal(missingSecret.status, 503);

  const missingBearer = await routeRequest(
    request("/search?q=test&format=json"),
    { SEARXNG_AUTH_TOKEN: TOKEN },
    container.factory,
  );
  assert.equal(missingBearer.status, 401);
  assert.equal(missingBearer.headers.get("WWW-Authenticate"), "Bearer");

  const wrongBearer = await routeRequest(
    request("/search?q=test&format=json", {
      headers: { Authorization: "Bearer wrong" },
    }),
    { SEARXNG_AUTH_TOKEN: TOKEN },
    container.factory,
  );
  assert.equal(wrongBearer.status, 401);
  assert.equal(container.calls.length, 0);
});

test("authenticated JSON is proxied without exposing the bearer token", async () => {
  const container = fakeContainer(new Response(JSON.stringify({ results: [] }), {
    headers: { "Content-Type": "application/json" },
  }));
  const response = await routeRequest(
    request("/search?q=test&format=json", {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "CF-Connecting-IP": "203.0.113.10",
        "X-Forwarded-For": "10.0.0.1",
        "X-Real-IP": "10.0.0.2",
      },
    }),
    { SEARXNG_AUTH_TOKEN: TOKEN },
    container.factory,
  );

  assert.equal(response.status, 200);
  assert.equal(container.calls.length, 1);
  assert.equal(container.calls[0].headers.has("Authorization"), false);
  assert.equal(container.calls[0].headers.has("X-Forwarded-For"), false);
  assert.equal(container.calls[0].headers.get("X-Real-IP"), "203.0.113.10");
  assert.equal(container.calls[0].headers.get("X-Forwarded-Host"), "searxng.example");
  assert.equal(container.calls[0].headers.get("X-Forwarded-Proto"), "https");
});

test("JSON Accept headers use the same gate", async () => {
  for (const accept of ["application/json", "application/json; q=0.9", "text/html, application/json;q=0.8"]) {
    const response = await routeRequest(
      request("/search?q=test", { headers: { Accept: accept } }),
      { SEARXNG_AUTH_TOKEN: TOKEN },
      fakeContainer().factory,
    );
    assert.equal(response.status, 401, accept);
  }
});

test("POST search is rejected before it can bypass the query-string gate", async () => {
  const container = fakeContainer();
  const response = await routeRequest(
    request("/search", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "q=test&format=json",
    }),
    { SEARXNG_AUTH_TOKEN: TOKEN },
    container.factory,
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET");
  assert.equal(container.calls.length, 0);
});

test("container failures produce a retryable service response", async () => {
  const response = await routeRequest(request("/"), {}, () => ({
    async fetch() {
      throw new Error("starting");
    },
  }));

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "2");
  assert.deepEqual(await response.json(), { error: "SearXNG is starting or unavailable" });
});

test("proxy classification does not treat HTML as machine JSON", () => {
  assert.equal(internals.isJsonSearch(request("/search?q=test"), new URL(request("/search?q=test").url)), false);
  assert.equal(internals.isJsonSearch(request("/search?q=test&format=json"), new URL(request("/search?q=test&format=json").url)), true);
});
