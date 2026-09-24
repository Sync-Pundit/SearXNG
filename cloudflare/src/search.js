import { BraveError, searchBrave } from "./brave.js";
import { BraveHtmlError, searchBraveHtml } from "./brave-html.js";
import { DuckDuckGoError, searchDuckDuckGo } from "./duckduckgo.js";
import { GoogleCseError, searchGoogleCse } from "./google-cse.js";
import { searchSerper } from "./serper.js";

const MAX_CONCURRENT_ENGINES = 6;
const SUPPORTED_ENGINES = new Set(["brave", "braveapi", "duckduckgo", "google cse"]);

const ENGINE_ADAPTERS = Object.freeze({
  brave: ({ query, page, fetcher, rewriterFactory }) => (
    searchBraveHtml(query, page, fetcher, rewriterFactory)
  ),
  braveapi: ({ query, page, env, fetcher }) => (
    searchBrave(query, page, env.BRAVE_API_KEY, fetcher)
  ),
  duckduckgo: ({ query, page, fetcher, rewriterFactory }) => (
    searchDuckDuckGo(query, page, fetcher, rewriterFactory)
  ),
  "google cse": ({ query, page, fetcher }) => searchGoogleCse(query, page, fetcher),
});

function responseBody(query, results, unresponsiveEngines = []) {
  return {
    query,
    results,
    answers: [],
    corrections: [],
    infoboxes: [],
    suggestions: [],
    unresponsive_engines: unresponsiveEngines,
  };
}

function error(status, message) {
  return { status, body: { error: message } };
}

function defaultEngines(env) {
  const engines = ["duckduckgo", "google cse"];
  if (env.BRAVE_API_KEY) engines.push("braveapi");
  return engines;
}

function parseRequest(url, env) {
  const query = url.searchParams.get("q") || "";
  if (!query.trim()) return error(400, "No query");
  if (query.length >= 500) {
    return error(400, "Search queries must be shorter than 500 characters");
  }

  const format = url.searchParams.get("format") || "json";
  if (format !== "json") return error(406, "Only format=json is supported");

  const rawPage = url.searchParams.get("pageno") || "1";
  if (!/^[1-9]\d*$/.test(rawPage)) {
    return error(400, "pageno must be a positive integer");
  }

  const rawEngines = url.searchParams.get("engines") || "";
  const engines = rawEngines.trim()
    ? [...new Set(rawEngines.split(",").map((name) => name.trim()).filter(Boolean))]
    : defaultEngines(env);
  if (engines.length === 0 || engines.some((name) => !SUPPORTED_ENGINES.has(name))) {
    return error(400, "Unsupported search engine");
  }

  const page = Number(rawPage);
  if (page > 10 && engines.some((name) => name === "brave" || name === "braveapi")) {
    return error(400, "Brave engines support pages 1 through 10");
  }
  if (page > 5 && engines.includes("google cse")) {
    return error(400, "Google CSE supports pages 1 through 5");
  }

  return { engines, page, query };
}

function failureReason(value) {
  return value instanceof DuckDuckGoError
    || value instanceof BraveError
    || value instanceof BraveHtmlError
    || value instanceof GoogleCseError
    ? value.reason
    : "unexpected error";
}

async function mapBounded(values, limit, operation) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(values[index]);
    }
  }

  const workerCount = Math.min(limit, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function runEngine(name, request, dependencies) {
  if (name === "braveapi" && !dependencies.env.BRAVE_API_KEY) {
    return { name, ok: false, reason: "not configured" };
  }

  try {
    const results = await ENGINE_ADAPTERS[name]({ ...request, ...dependencies });
    return { name, ok: true, results };
  } catch (caught) {
    return { name, ok: false, reason: failureReason(caught) };
  }
}

function serperPrimaryEngines(env) {
  const value = env.SERPER_PRIMARY_ENGINES || "google,google cse";
  return new Set(value.split(",").map((name) => name.trim().toLowerCase()).filter(Boolean));
}

async function serperFallback(request, outcomes, dependencies) {
  if (!dependencies.env.SERPER_API_KEY) return null;
  const maxPage = Number.parseInt(dependencies.env.SERPER_MAX_PAGE || "5", 10);
  if (request.page > (Number.isFinite(maxPage) ? maxPage : 5)) return null;

  const primaries = serperPrimaryEngines(dependencies.env);
  const gating = outcomes.filter((outcome) => primaries.has(outcome.name.toLowerCase()));
  if (gating.length === 0) return null;
  if (gating.some((outcome) => outcome.ok && outcome.results.length > 0)) return null;

  try {
    const results = await searchSerper(
      request.query,
      request.page,
      dependencies.env.SERPER_API_KEY,
      dependencies.fetcher,
    );
    return { name: "plugin: serper_fallback", ok: true, results };
  } catch {
    // The retained plugin treats a failed fallback as non-fatal.
    return null;
  }
}

function resultKey(result) {
  try {
    const url = new URL(result.url);
    return [
      result.template || "default.html",
      url.host.toLowerCase(),
      url.pathname,
      url.search,
      url.hash,
      result.img_src || "",
    ].join("|");
  } catch {
    return null;
  }
}

function resultScore(positions) {
  return positions.length * positions.reduce((score, position) => score + (1 / position), 0);
}

function mergeResults(engineResults) {
  const merged = new Map();
  let order = 0;

  for (const results of engineResults) {
    for (const result of results) {
      const key = resultKey(result);
      if (!key) continue;

      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { order, result: { ...result } });
        order += 1;
        continue;
      }

      const current = existing.result;
      if ((result.content || "").length > (current.content || "").length) {
        current.content = result.content;
      }
      if ((result.title || "").length > (current.title || "").length) {
        current.title = result.title;
      }
      for (const [field, value] of Object.entries(result)) {
        if (!(field in current)) current[field] = value;
      }
      for (const engine of result.engines || [result.engine]) {
        if (engine && !current.engines.includes(engine)) current.engines.push(engine);
      }
      current.positions.push(...(result.positions || []));

      const currentUrl = new URL(current.url);
      const candidateUrl = new URL(result.url);
      if (currentUrl.protocol !== "https:" && candidateUrl.protocol === "https:") {
        current.url = result.url;
      }
    }
  }

  return [...merged.values()]
    .map(({ order: firstSeen, result }) => ({
      firstSeen,
      result: { ...result, score: resultScore(result.positions) },
    }))
    .sort((left, right) => right.result.score - left.result.score || left.firstSeen - right.firstSeen)
    .map(({ result }) => result);
}

export async function runSearch(
  url,
  env = {},
  fetcher = fetch,
  rewriterFactory = () => new HTMLRewriter(),
) {
  const request = parseRequest(url, env);
  if (request.status) return request;

  const outcomes = await mapBounded(
    request.engines,
    MAX_CONCURRENT_ENGINES,
    (name) => runEngine(name, request, { env, fetcher, rewriterFactory }),
  );
  const fallback = await serperFallback(request, outcomes, { env, fetcher });
  const completed = outcomes.filter((outcome) => outcome.ok);
  if (fallback) completed.push(fallback);
  const unresponsive = outcomes
    .filter((outcome) => !outcome.ok)
    .map((outcome) => [outcome.name, outcome.reason]);
  const body = responseBody(
    request.query,
    mergeResults(completed.map((outcome) => outcome.results)),
    unresponsive,
  );

  if (completed.length > 0) return { status: 200, body };
  const status = unresponsive.every(([, reason]) => reason === "not configured") ? 503 : 502;
  return { status, body: { error: "Search provider unavailable", ...body } };
}
