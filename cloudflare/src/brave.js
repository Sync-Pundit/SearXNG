const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const ENGINE_NAME = "braveapi";
const TIMEOUT_MS = 8_000;

export class BraveError extends Error {
  constructor(message, reason = "unexpected error") {
    super(message);
    this.name = "BraveError";
    this.reason = reason;
  }
}

function plainText(value) {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (match, entity) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
      }
      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
      }
      return entities[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
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
  return ((data.web || {}).results || []).flatMap((result) => {
    const url = resultUrl(result.url);
    if (!url || seen.has(url)) {
      return [];
    }
    seen.add(url);
    const position = seen.size;
    return [{
      category: "general",
      content: plainText(result.description),
      engine: ENGINE_NAME,
      engines: [ENGINE_NAME],
      positions: [position],
      publishedDate: result.age || null,
      score: 1 / position,
      template: "default.html",
      title: plainText(result.title) || url,
      url,
    }];
  });
}

async function failureReason(response) {
  if (response.status === 401 || response.status === 403) return "authentication error";
  if (response.status === 402) return "usage limit exceeded";
  if (response.status === 422) {
    try {
      const data = await response.clone().json();
      if (data?.error?.code === "SUBSCRIPTION_TOKEN_INVALID") return "authentication error";
    } catch {
      // The status still identifies a rejected request when the error body is not JSON.
    }
    return "query rejected";
  }
  if (response.status === 429) return "rate limited";
  return "HTTP error";
}

export async function searchBrave(query, page, apiKey, fetcher = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("search timeout"), TIMEOUT_MS);
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    q: query,
    count: "20",
    offset: String(page - 1),
    text_decorations: "false",
  });

  try {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "error",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BraveError(`Brave returned HTTP ${response.status}`, await failureReason(response));
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new BraveError("Brave returned invalid JSON", "parsing error");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new BraveError("Brave returned an invalid response", "parsing error");
    }
    if (data.web?.results !== undefined && !Array.isArray(data.web.results)) {
      throw new BraveError("Brave returned invalid web results", "parsing error");
    }
    return compatibleResults(data);
  } catch (error) {
    if (error instanceof BraveError) throw error;
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new BraveError("Brave search timed out", "timeout");
    }
    throw new BraveError("Brave search failed", "network error");
  } finally {
    clearTimeout(timeout);
  }
}

export const braveEndpoint = ENDPOINT;
