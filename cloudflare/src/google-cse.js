const CX = "partner-pub-8993703457585266:4862972284";
const TOKEN_ENDPOINT = "https://www.google.com/cse/cse.js";
const SEARCH_ENDPOINT = "https://cse.google.com/cse/element/v1";
const ENGINE_NAME = "google cse";
const TIMEOUT_MS = 12_000;
// minimal: isolate-local cache; use Cache API when repeated token fetches become measurable
const tokenCache = new WeakMap();

export class GoogleCseError extends Error {
  constructor(message, reason = "unexpected error") {
    super(message);
    this.name = "GoogleCseError";
    this.reason = reason;
  }
}

function parseObject(text, label) {
  const end = text.lastIndexOf("});");
  const start = text.lastIndexOf("({", end);
  if (start < 0 || end <= start) {
    throw new GoogleCseError(`Google CSE returned invalid ${label}`, "parsing error");
  }
  try {
    return JSON.parse(text.slice(start + 1, end + 1));
  } catch {
    throw new GoogleCseError(`Google CSE returned invalid ${label}`, "parsing error");
  }
}

async function readToken(fetcher, signal) {
  const cached = tokenCache.get(fetcher);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(TOKEN_ENDPOINT);
  url.searchParams.set("cx", CX);
  const response = await fetcher(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "application/javascript,*/*;q=0.8",
      Referer: "https://cse.google.com/",
    },
    signal,
  });
  if (!response.ok) {
    const reason = response.status === 429 ? "rate limited" : "HTTP error";
    throw new GoogleCseError(`Google CSE token endpoint returned HTTP ${response.status}`, reason);
  }

  const data = parseObject(await response.text(), "token response");
  if (!data.cse_token) {
    throw new GoogleCseError("Google CSE did not return a token", "parsing error");
  }
  const value = {
    cseToken: data.cse_token,
    cseLibVersion: data.cselibVersion || "",
    exp: Array.isArray(data.exp) ? data.exp.join(",") : "",
  };
  tokenCache.set(fetcher, { expiresAt: Date.now() + 55 * 60 * 1_000, value });
  return value;
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
  return (Array.isArray(data.results) ? data.results : []).flatMap((result) => {
    const url = resultUrl(result.unescapedUrl);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const position = seen.size;
    return [{
      category: "general",
      content: String(result.contentNoFormatting || "").trim(),
      engine: ENGINE_NAME,
      engines: [ENGINE_NAME],
      positions: [position],
      score: 1 / position,
      template: "default.html",
      title: String(result.titleNoFormatting || "").trim() || url,
      url,
    }];
  });
}

export async function searchGoogleCse(query, page, fetcher = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("search timeout"), TIMEOUT_MS);

  try {
    const token = await readToken(fetcher, controller.signal);
    const url = new URL(SEARCH_ENDPOINT);
    url.search = new URLSearchParams({
      callback: "_",
      cse_tok: token.cseToken,
      cselibv: token.cseLibVersion,
      cx: CX,
      hl: "en",
      num: "20",
      q: query,
      rsz: "filtered_cse",
      rurl: "",
      safe: "off",
      searchtype: "",
    });
    if (token.exp) url.searchParams.set("exp", token.exp);
    if (page > 1) url.searchParams.set("start", String((page - 1) * 20));

    const response = await fetcher(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "*/*",
        Cookie: "CONSENT=YES+",
        Referer: "https://cse.google.com/",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const reason = response.status === 429 ? "rate limited" : "HTTP error";
      throw new GoogleCseError(`Google CSE returned HTTP ${response.status}`, reason);
    }

    const data = parseObject(await response.text(), "search response");
    if (data.error) {
      const reason = data.error.code === 429 ? "rate limited" : "query rejected";
      throw new GoogleCseError(`Google CSE rejected the query: ${data.error.message || reason}`, reason);
    }
    if (data.results !== undefined && !Array.isArray(data.results)) {
      throw new GoogleCseError("Google CSE returned invalid results", "parsing error");
    }
    return compatibleResults(data);
  } catch (caught) {
    if (caught instanceof GoogleCseError) throw caught;
    if (controller.signal.aborted || caught?.name === "AbortError") {
      throw new GoogleCseError("Google CSE search timed out", "timeout");
    }
    throw new GoogleCseError("Google CSE search failed", "network error");
  } finally {
    clearTimeout(timeout);
  }
}

export const googleCseEndpoint = SEARCH_ENDPOINT;
export const googleCseTokenEndpoint = TOKEN_ENDPOINT;
