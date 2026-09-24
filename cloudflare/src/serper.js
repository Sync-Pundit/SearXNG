const ENDPOINT = "https://google.serper.dev/search";
const ENGINE_NAME = "plugin: serper_fallback";
const TIMEOUT_MS = 10_000;

export class SerperError extends Error {
  constructor(message, reason = "unexpected error") {
    super(message);
    this.name = "SerperError";
    this.reason = reason;
  }
}

function resultUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function compatibleResults(data) {
  const seen = new Set();
  return (Array.isArray(data.organic) ? data.organic : []).flatMap((result) => {
    const url = resultUrl(result.link);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const position = seen.size;
    return [{
      category: "general",
      content: String(result.snippet || "").trim(),
      engine: ENGINE_NAME,
      engines: [ENGINE_NAME],
      positions: [position],
      score: 1 / position,
      template: "default.html",
      title: String(result.title || "").trim() || url,
      url,
    }];
  });
}

export async function searchSerper(query, page, apiKey, fetcher = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("search timeout"), TIMEOUT_MS);
  const payload = { q: query, num: 10 };
  if (page > 1) payload.page = page;

  try {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const reason = response.status === 429 ? "rate limited" : "HTTP error";
      throw new SerperError(`Serper returned HTTP ${response.status}`, reason);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new SerperError("Serper returned invalid JSON", "parsing error");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new SerperError("Serper returned an invalid response", "parsing error");
    }
    return compatibleResults(data);
  } catch (caught) {
    if (caught instanceof SerperError) throw caught;
    if (controller.signal.aborted || caught?.name === "AbortError") {
      throw new SerperError("Serper search timed out", "timeout");
    }
    throw new SerperError("Serper search failed", "network error");
  } finally {
    clearTimeout(timeout);
  }
}

export const serperEndpoint = ENDPOINT;
