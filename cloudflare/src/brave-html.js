const ENDPOINT = "https://search.brave.com/search";
const ENGINE_NAME = "brave";
const TIMEOUT_MS = 20_000;

export class BraveHtmlError extends Error {
  constructor(message, reason = "unexpected error") {
    super(message);
    this.name = "BraveHtmlError";
    this.reason = reason;
  }
}

function cleanText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function resultUrl(value) {
  try {
    const parsed = new URL(value, ENDPOINT);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export async function parseBraveHtml(response, rewriterFactory = () => new HTMLRewriter()) {
  const state = {
    captcha: false,
    current: null,
    noResults: false,
    resultContainers: 0,
    results: [],
    searchPage: false,
  };

  const append = (field, text) => {
    if (state.current) {
      state.current[field] += text.text;
    }
  };

  const rewriter = rewriterFactory()
    .on("main#search-page", {
      element() {
        state.searchPage = true;
      },
    })
    .on("form#challenge-form", {
      element() {
        state.captcha = true;
      },
    })
    .on("div.no-results", {
      element() {
        state.noResults = true;
      },
    })
    .on('div.snippet[data-type="web"]', {
      element(element) {
        state.resultContainers += 1;
        state.current = { content: "", title: "", url: "" };
        element.onEndTag(() => {
          const url = resultUrl(state.current?.url);
          if (url) {
            state.results.push({
              content: cleanText(state.current.content),
              title: cleanText(state.current.title) || url,
              url,
            });
          }
          state.current = null;
        });
      },
    })
    .on('div.snippet[data-type="web"] div.result-content > a[href]', {
      element(element) {
        if (state.current && !state.current.url) {
          state.current.url = element.getAttribute("href") || "";
        }
      },
    })
    .on('div.snippet[data-type="web"] div.search-snippet-title', {
      text(text) {
        append("title", text);
      },
    })
    .on('div.snippet[data-type="web"] div.generic-snippet div.content', {
      text(text) {
        append("content", text);
      },
    });

  await rewriter.transform(response).text();

  if (state.captcha) {
    throw new BraveHtmlError("Brave returned a CAPTCHA", "CAPTCHA");
  }
  if (!state.searchPage || (state.resultContainers === 0 && !state.noResults)) {
    throw new BraveHtmlError("Brave returned an unrecognized search page", "parsing error");
  }
  if (state.resultContainers > 0 && state.results.length === 0) {
    throw new BraveHtmlError("Brave results could not be parsed", "parsing error");
  }

  return state.results;
}

function compatibleResults(results) {
  const seen = new Set();
  return results.flatMap((result) => {
    if (seen.has(result.url)) {
      return [];
    }
    seen.add(result.url);
    const position = seen.size;
    return [{
      ...result,
      category: "general",
      engine: ENGINE_NAME,
      engines: [ENGINE_NAME],
      positions: [position],
      score: 1 / position,
      template: "default.html",
    }];
  });
}

export async function searchBraveHtml(
  query,
  page,
  fetcher = fetch,
  rewriterFactory = () => new HTMLRewriter(),
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("search timeout"), TIMEOUT_MS);
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    q: query,
    source: "web",
    spellcheck: "0",
  });
  if (page > 1) {
    url.searchParams.set("offset", String(page - 1));
  }

  try {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.7",
        Cookie: "safesearch=moderate; useLocation=0; summarizer=0",
        "User-Agent": "Mozilla/5.0 (compatible; SearXNG/2026.9; +https://github.com/searxng/searxng)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const reason = response.status === 429 ? "rate limited" : "HTTP error";
      throw new BraveHtmlError(`Brave returned HTTP ${response.status}`, reason);
    }
    if (!(response.headers.get("Content-Type") || "").toLowerCase().includes("text/html")) {
      throw new BraveHtmlError("Brave returned a non-HTML response", "parsing error");
    }

    return compatibleResults(await parseBraveHtml(response, rewriterFactory));
  } catch (error) {
    if (error instanceof BraveHtmlError) throw error;
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new BraveHtmlError("Brave search timed out", "timeout");
    }
    throw new BraveHtmlError("Brave search failed", "network error");
  } finally {
    clearTimeout(timeout);
  }
}

export const braveHtmlEndpoint = ENDPOINT;
