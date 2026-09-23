const ENDPOINT = "https://html.duckduckgo.com/html/";
const ENGINE_NAME = "duckduckgo";
const TIMEOUT_MS = 8_000;

export class DuckDuckGoError extends Error {
  constructor(message, reason = "unexpected error") {
    super(message);
    this.name = "DuckDuckGoError";
    this.reason = reason;
  }
}

function cleanText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function resultUrl(value) {
  if (!value) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(value.startsWith("//") ? `https:${value}` : value, ENDPOINT);
  } catch {
    return null;
  }

  if (parsed.hostname.endsWith("duckduckgo.com") && parsed.pathname === "/l/") {
    const destination = parsed.searchParams.get("uddg");
    if (destination) {
      try {
        parsed = new URL(destination);
      } catch {
        return null;
      }
    }
  }

  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
}

export async function parseDuckDuckGo(response, rewriterFactory = () => new HTMLRewriter()) {
  const state = {
    captcha: false,
    current: null,
    results: [],
    vqd: "",
  };

  const append = (field, text) => {
    if (state.current) {
      state.current[field] += text.text;
    }
  };

  const rewriter = rewriterFactory()
    .on("form#challenge-form", {
      element() {
        state.captcha = true;
      },
    })
    .on('input[name="vqd"]', {
      element(element) {
        state.vqd ||= element.getAttribute("value") || "";
      },
    })
    .on("div#links > div.web-result", {
      element(element) {
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
    .on("div#links > div.web-result h2 a", {
      element(element) {
        if (state.current) {
          state.current.url = element.getAttribute("href") || "";
        }
      },
      text(text) {
        append("title", text);
      },
    })
    .on("div#links > div.web-result a.result__snippet", {
      text(text) {
        append("content", text);
      },
    });

  await rewriter.transform(response).text();
  return state;
}

function requestBody(query, page, vqd = "") {
  const body = new URLSearchParams({ kl: "wt-wt", q: query });

  if (page === 1) {
    body.set("b", "");
    return body;
  }

  const offset = 10 + (page - 2) * 15;
  body.set("api", "d.js");
  body.set("dc", String(offset + 1));
  body.set("nextParams", "");
  body.set("o", "json");
  body.set("s", String(offset));
  body.set("v", "l");
  body.set("vqd", vqd);
  return body;
}

async function fetchPage(query, page, vqd, fetcher, rewriterFactory, signal) {
  const response = await fetcher(ENDPOINT, {
    method: "POST",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: ENDPOINT,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "User-Agent": "Mozilla/5.0 (compatible; SearXNG/2026.9; +https://github.com/searxng/searxng)",
    },
    body: requestBody(query, page, vqd),
    signal,
  });

  if (!response.ok) {
    throw new DuckDuckGoError(`DuckDuckGo returned HTTP ${response.status}`, "HTTP error");
  }

  const parsed = await parseDuckDuckGo(response, rewriterFactory);
  if (parsed.captcha) {
    throw new DuckDuckGoError("DuckDuckGo returned a CAPTCHA", "CAPTCHA");
  }
  return parsed;
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

export async function searchDuckDuckGo(
  query,
  page,
  fetcher = fetch,
  rewriterFactory = () => new HTMLRewriter(),
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("search timeout"), TIMEOUT_MS);

  try {
    // minimal: refetch page 1 until measured pagination traffic justifies shared continuation storage
    const firstPage = await fetchPage(query, 1, "", fetcher, rewriterFactory, controller.signal);
    if (page === 1) {
      return compatibleResults(firstPage.results);
    }
    if (!firstPage.vqd) {
      throw new DuckDuckGoError("DuckDuckGo did not return a pagination token", "parsing error");
    }
    const requestedPage = await fetchPage(
      query,
      page,
      firstPage.vqd,
      fetcher,
      rewriterFactory,
      controller.signal,
    );
    return compatibleResults(requestedPage.results);
  } catch (error) {
    if (error instanceof DuckDuckGoError) {
      throw error;
    }
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new DuckDuckGoError("DuckDuckGo search timed out", "timeout");
    }
    throw new DuckDuckGoError("DuckDuckGo search failed", "network error");
  } finally {
    clearTimeout(timeout);
  }
}

export const duckDuckGoEndpoint = ENDPOINT;
