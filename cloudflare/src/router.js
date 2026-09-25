const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": JSON_CONTENT_TYPE,
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

async function digest(value) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function tokensMatch(provided, expected) {
  const [providedHash, expectedHash] = await Promise.all([
    digest(provided),
    digest(expected),
  ]);
  let mismatch = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    mismatch |= providedHash[index] ^ expectedHash[index];
  }
  return mismatch === 0;
}

async function authorize(request, env) {
  if (!env.SEARXNG_AUTH_TOKEN) {
    return json({ error: "SEARXNG_AUTH_TOKEN is not configured" }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "Bearer authentication is required" }, 401, {
      "WWW-Authenticate": "Bearer",
    });
  }

  if (!(await tokensMatch(authorization.slice(7), env.SEARXNG_AUTH_TOKEN))) {
    return json({ error: "Bearer authentication failed" }, 401, {
      "WWW-Authenticate": "Bearer",
    });
  }
  return null;
}

function isJsonSearch(request, url) {
  if (url.pathname !== "/search") return false;
  if (url.searchParams.get("format") === "json") return true;
  return request.headers.get("Accept")?.split(",").some((value) => (
    value.trim().toLowerCase().split(";", 1)[0] === "application/json"
  )) || false;
}

function proxiedRequest(request) {
  const headers = new Headers(request.headers);
  headers.delete("Authorization");
  headers.delete("X-Forwarded-For");
  headers.delete("X-Real-IP");
  headers.set("X-Real-IP", headers.get("CF-Connecting-IP") || "127.0.0.1");
  headers.set("X-Forwarded-Host", new URL(request.url).host);
  headers.set("X-Forwarded-Proto", "https");
  return new Request(request, { headers });
}

export async function routeRequest(request, env = {}, containerFactory) {
  const url = new URL(request.url);

  if (url.pathname === "/healthz") {
    return json({
      ok: true,
      runtime: "cloudflare-container",
      worker: "searxng",
    });
  }

  if (url.pathname === "/search" && request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
  }

  if (isJsonSearch(request, url)) {
    const authError = await authorize(request, env);
    if (authError) return authError;
  }

  if (typeof containerFactory !== "function") {
    return json({ error: "SearXNG container is unavailable" }, 503);
  }

  const started = performance.now();
  try {
    const response = await containerFactory().fetch(proxiedRequest(request));
    const headers = new Headers(response.headers);
    headers.append("Server-Timing", `edge;dur=${(performance.now() - started).toFixed(1)}`);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (caught) {
    console.error("SearXNG container request failed", caught);
    return json({ error: "SearXNG is starting or unavailable" }, 503, {
      "Retry-After": "2",
      "Server-Timing": `edge;dur=${(performance.now() - started).toFixed(1)}`,
    });
  }
}

export const internals = Object.freeze({ isJsonSearch, proxiedRequest });
