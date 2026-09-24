import { runSearch } from "./search.js";
import { searchUi } from "./ui.js";

const SAMPLE_LIMIT_BYTES = 64 * 1024;
const PROBE_TIMEOUT_MS = 8_000;

const PROBES = Object.freeze({
  "example-html": Object.freeze({
    description: "Fetch a small HTML document over HTTPS.",
    hostname: "example.com",
    request: Object.freeze({
      url: "https://example.com/",
      init: Object.freeze({ method: "GET", redirect: "follow" }),
    }),
  }),
  "github-json": Object.freeze({
    description: "Fetch and sample a public JSON API response.",
    hostname: "api.github.com",
    request: Object.freeze({
      url: "https://api.github.com/repos/Sync-Pundit/SearXNG",
      init: Object.freeze({
        method: "GET",
        redirect: "follow",
        headers: Object.freeze({
          Accept: "application/vnd.github+json",
          "User-Agent": "searxng-cloudflare-compat/0.1",
        }),
      }),
    }),
  }),
  "redirect-chain": Object.freeze({
    description: "Follow a two-hop public redirect chain.",
    hostname: "httpbin.org",
    request: Object.freeze({
      url: "https://httpbin.org/redirect/2",
      init: Object.freeze({ method: "GET", redirect: "follow" }),
    }),
  }),
  "duckduckgo-html": Object.freeze({
    description: "Submit a fixed form query to the DuckDuckGo HTML endpoint.",
    hostname: "html.duckduckgo.com",
    request: Object.freeze({
      url: "https://html.duckduckgo.com/html/",
      init: Object.freeze({
        method: "POST",
        redirect: "follow",
        headers: Object.freeze({
          Accept: "text/html,application/xhtml+xml",
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        body: "q=cloudflare+searxng+compatibility+probe",
      }),
    }),
  }),
});

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function publicProbeCatalog() {
  return Object.entries(PROBES).map(([name, probe]) => ({
    name,
    description: probe.description,
    hostname: probe.hostname,
  }));
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function tokensMatch(provided, expected) {
  const [providedHash, expectedHash] = await Promise.all([digest(provided), digest(expected)]);
  let mismatch = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    mismatch |= providedHash[index] ^ expectedHash[index];
  }
  return mismatch === 0;
}

async function authorize(request, env) {
  if (!env.SPIKE_AUTH_TOKEN) {
    return json({ error: "SPIKE_AUTH_TOKEN is not configured" }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) {
    return json({ error: "Bearer authentication is required" }, 401, {
      "WWW-Authenticate": "Bearer",
    });
  }

  const provided = authorization.slice(prefix.length);
  if (!(await tokensMatch(provided, env.SPIKE_AUTH_TOKEN))) {
    return json({ error: "Bearer authentication failed" }, 401, {
      "WWW-Authenticate": "Bearer",
    });
  }

  return null;
}

async function parseRunRequest(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { error: json({ error: "Content-Type must be application/json" }, 415) };
  }

  const declaredLength = Number(request.headers.get("Content-Length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > 4_096) {
    return { error: json({ error: "Request body exceeds 4096 bytes" }, 413) };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 4_096) {
    return { error: json({ error: "Request body exceeds 4096 bytes" }, 413) };
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: json({ error: "Request body is not valid JSON" }, 400) };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: json({ error: "Request body must be an object" }, 400) };
  }

  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "probes") {
    return { error: json({ error: "Request body may contain only the probes field" }, 400) };
  }

  if (!Array.isArray(body.probes) || body.probes.length === 0) {
    return { error: json({ error: "probes must be a non-empty array" }, 400) };
  }

  const names = [...new Set(body.probes)];
  if (names.length !== body.probes.length || names.length > Object.keys(PROBES).length) {
    return { error: json({ error: "probes must contain unique supported names" }, 400) };
  }

  const unsupported = names.filter((name) => typeof name !== "string" || !PROBES[name]);
  if (unsupported.length > 0) {
    return { error: json({ error: "Unsupported probe", unsupported }, 400) };
  }

  return { names };
}

async function readSample(body, limit) {
  if (!body) {
    return new Uint8Array();
  }

  const reader = body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const remaining = limit - total;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.byteLength;
      if (value.byteLength > remaining) {
        await reader.cancel("sample limit reached");
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const sample = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    sample.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return sample;
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function runProbe(name, fetcher = fetch) {
  const probe = PROBES[name];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("probe timeout"), PROBE_TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetcher(probe.request.url, {
      ...probe.request.init,
      signal: controller.signal,
    });
    const sample = await readSample(response.body, SAMPLE_LIMIT_BYTES);
    const sampleHash = new Uint8Array(await crypto.subtle.digest("SHA-256", sample));
    const finalUrl = response.url ? new URL(response.url) : null;

    return {
      name,
      ok: response.ok,
      status: response.status,
      redirected: response.redirected,
      finalHostname: finalUrl?.hostname || probe.hostname,
      contentType: response.headers.get("Content-Type") || "",
      sampledBytes: sample.byteLength,
      sampleSha256: toHex(sampleHash),
      elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.name : "ProbeError",
      elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleRequest(
  request,
  env = {},
  fetcher = fetch,
  rewriterFactory = () => new HTMLRewriter(),
) {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/static/themes/simple/")) {
    if (!env.ASSETS) {
      return json({ error: "Static assets are not configured" }, 503);
    }
    const assetUrl = new URL(request.url);
    assetUrl.pathname = url.pathname.slice("/static/themes/simple".length);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  }

  if (url.pathname === "/healthz" && (request.method === "GET" || request.method === "HEAD")) {
    return json({ ok: true, worker: "searxng" });
  }

  if (url.pathname === "/" && request.method === "GET") {
    return searchUi({ braveApiConfigured: Boolean(env.BRAVE_API_KEY) });
  }

  if (url.pathname === "/compat" && request.method === "GET") {
    return json({ probes: publicProbeCatalog() });
  }

  if (url.pathname === "/compat/run") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
    }

    const authError = await authorize(request, env);
    if (authError) {
      return authError;
    }

    const parsed = await parseRunRequest(request);
    if (parsed.error) {
      return parsed.error;
    }

    const results = await Promise.all(parsed.names.map((name) => runProbe(name, fetcher)));
    return json({ results });
  }

  if (url.pathname === "/search") {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
    }

    const format = url.searchParams.get("format") || "html";
    if (format === "json") {
      const authError = await authorize(request, env);
      if (authError) {
        return authError;
      }

      const result = await runSearch(url, env, fetcher, rewriterFactory);
      return json(result.body, result.status);
    }

    if (format !== "html") {
      return json({ error: "Only HTML and JSON search formats are supported" }, 406);
    }

    const searchUrl = new URL(url);
    searchUrl.searchParams.set("format", "json");
    const result = await runSearch(searchUrl, env, fetcher, rewriterFactory);
    return searchUi({
      braveApiConfigured: Boolean(env.BRAVE_API_KEY),
      initialSearch: { payload: result.body, status: result.status },
    });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env, fetch, () => new HTMLRewriter());
  },
};
