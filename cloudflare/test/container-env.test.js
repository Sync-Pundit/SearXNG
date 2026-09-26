import assert from "node:assert/strict";
import test from "node:test";

import { containerEnv } from "../src/container-env.js";

test("Worker secrets and configuration are passed to the container", () => {
  const values = containerEnv({
    BRAVE_API_KEY: "brave-secret",
    SEARXNG_BASE_URL: "https://search.example/",
    SEARXNG_SECRET: "session-secret",
    SERPER_API_KEY: "serper-secret",
    SERPER_MAX_PAGE: "3",
    SERPER_PRIMARY_ENGINES: "google,yahoo,dogpile",
  });

  assert.deepEqual(values, {
    BRAVE_API_KEY: "brave-secret",
    FALLBACK_PROXY_BASE: "http://api-fallback.internal",
    SEARXNG_BASE_URL: "https://search.example/",
    SEARXNG_SECRET: "session-secret",
    SERPER_API_KEY: "serper-secret",
    SERPER_MAX_PAGE: "3",
    SERPER_PRIMARY_ENGINES: "google,yahoo,dogpile",
  });
});

test("Container defaults remain usable when optional Worker values are absent", () => {
  assert.deepEqual(containerEnv({}), {
    BRAVE_API_KEY: "",
    FALLBACK_PROXY_BASE: "http://api-fallback.internal",
    SEARXNG_BASE_URL: "https://searxng.pundit.workers.dev/",
    SEARXNG_SECRET: "",
    SERPER_API_KEY: "",
    SERPER_MAX_PAGE: "5",
    SERPER_PRIMARY_ENGINES: "google,google cse,dogpile,dogpile images,yahoo",
  });
});
