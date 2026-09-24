const PAGE = `<!doctype html>
<html class="theme-auto center-alignment-no" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="description" content="SearXNG search compatibility on Cloudflare">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noarchive">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SearXNG</title>
  <link rel="stylesheet" href="/static/themes/simple/sxng-ltr.min.css" type="text/css" media="screen">
  <link rel="icon" href="/static/themes/simple/img/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="/static/themes/simple/manifest.json">
  <style nonce="__NONCE__">
    .cf-status {
      border: 1px solid var(--color-result-border);
      border-radius: 10px;
      margin: 0 .5rem 1rem;
      padding: .8rem 1rem;
      line-height: 1.5;
      background: var(--color-result-background);
    }
    .cf-status[data-kind="error"] { color: var(--color-error); border-color: var(--color-error); }
    .cf-status[data-kind="loading"] { color: var(--color-result-engines-font); }
    .cf-wordmark { display: block; width: 8rem; height: auto; }
    #main_index .cf-wordmark { width: min(21rem, 70vw); margin: 0 auto; }
    #main_results #search_logo { display: flex; align-items: center; }
    #main_results #search_logo .cf-wordmark { width: 8rem; }
    #main_results #search_logo .cf-mark { width: 3rem; }
    .cf-result-count { color: var(--color-result-engines-font); font-size: .9rem; }
    .cf-empty { margin: 1rem .5rem; }
    .cf-pagination-button[disabled] { opacity: .45; cursor: not-allowed; }
    @media screen and (max-width: 50em) {
      #main_results #search_logo .cf-mark { width: 2.25rem; }
    }
  </style>
</head>
<body class="index_endpoint">
  <main id="main_index">
    <section id="home-view" class="index">
      <div class="title">
        <img class="cf-wordmark" src="/static/themes/simple/img/searxng.svg" alt="SearXNG">
      </div>
      <form id="search" action="/search" method="get" role="search">
        <div id="search_header">
          <div id="search_view">
            <div class="search_box">
              <input id="q" name="q" type="text" placeholder="Search for..." autocomplete="off" autocapitalize="none" spellcheck="false" autocorrect="off" dir="auto" maxlength="499">
              <button id="clear_search" type="reset" aria-label="clear"><svg viewBox="0 0 512 512" class="sxng-icon-set-big" aria-hidden="true"><path d="M368 368 144 144M368 144 144 368" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg></button>
              <button id="send_search" type="submit" aria-label="search"><svg viewBox="0 0 512 512" class="sxng-icon-set-big" aria-hidden="true"><path d="M221.09 64a157.09 157.09 0 1 0 157.09 157.09A157.1 157.1 0 0 0 221.09 64Z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/><path d="M338.29 338.29 448 448" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"/></svg></button>
            </div>
          </div>
        </div>
        <div class="search_filters">
          <select id="engine" name="engines" aria-label="Search engine">
            <option value="">All available engines</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="google cse">Google CSE</option>
            <option value="brave">Brave</option>
            <option value="braveapi" __BRAVE_API_DISABLED__>Brave API__BRAVE_API_LABEL__</option>
          </select>
        </div>
      </form>
    </section>

    <section id="results-view" hidden>
      <form id="results-search" action="/search" method="get" role="search">
        <div id="search_header">
          <a id="search_logo" href="/" title="Display the front page">
            <img class="cf-wordmark cf-mark" src="/static/themes/simple/img/favicon.svg" alt="SearXNG">
          </a>
          <div id="search_view">
            <div class="search_box">
              <input id="q-results" name="q" type="text" placeholder="Search for..." autocomplete="off" autocapitalize="none" spellcheck="false" autocorrect="off" dir="auto" maxlength="499">
              <button type="reset" aria-label="clear"><svg viewBox="0 0 512 512" class="sxng-icon-set-big" aria-hidden="true"><path d="M368 368 144 144M368 144 144 368" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg></button>
              <button type="submit" aria-label="search"><svg viewBox="0 0 512 512" class="sxng-icon-set-big" aria-hidden="true"><path d="M221.09 64a157.09 157.09 0 1 0 157.09 157.09A157.1 157.1 0 0 0 221.09 64Z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/><path d="M338.29 338.29 448 448" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"/></svg></button>
            </div>
          </div>
        </div>
        <div class="search_filters">
          <select id="engine-results" name="engines" aria-label="Search engine">
            <option value="">All available engines</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="google cse">Google CSE</option>
            <option value="brave">Brave</option>
            <option value="braveapi" __BRAVE_API_DISABLED__>Brave API__BRAVE_API_LABEL__</option>
          </select>
        </div>
      </form>

      <div id="results">
        <div id="sidebar">
          <div class="cf-result-count" id="result-count"></div>
        </div>
        <div id="status" class="cf-status" role="status" aria-live="polite" hidden></div>
        <div id="urls" role="main"></div>
        <nav id="pagination" role="navigation" hidden>
          <div class="previous_page left">
            <button id="previous-page" class="cf-pagination-button" type="button">&#8592; Previous page</button>
          </div>
          <div class="next_page right">
            <button id="next-page" class="cf-pagination-button" type="button">Next page &#8594;</button>
          </div>
        </nav>
      </div>
    </section>
  </main>

  <footer>
    <p>Powered by <a href="https://docs.searxng.org/">SearXNG</a> on Cloudflare - a privacy-respecting metasearch migration.</p>
  </footer>

  <script nonce="__NONCE__">
    (() => {
      const initialSearch = __INITIAL_SEARCH__;
      const state = {
        engine: "",
        page: 1,
        query: "",
      };
      const main = document.querySelector("main");
      const homeView = document.getElementById("home-view");
      const resultsView = document.getElementById("results-view");
      const homeQuery = document.getElementById("q");
      const resultsQuery = document.getElementById("q-results");
      const homeEngine = document.getElementById("engine");
      const resultsEngine = document.getElementById("engine-results");
      const status = document.getElementById("status");
      const urls = document.getElementById("urls");
      const resultCount = document.getElementById("result-count");
      const pagination = document.getElementById("pagination");
      const previousPage = document.getElementById("previous-page");
      const nextPage = document.getElementById("next-page");

      function showStatus(message, kind = "loading") {
        status.hidden = false;
        status.dataset.kind = kind;
        status.textContent = message;
      }

      function hideStatus() {
        status.hidden = true;
        status.textContent = "";
      }

      function showResultsView() {
        homeView.hidden = true;
        resultsView.hidden = false;
        main.id = "main_results";
        document.body.className = "search_endpoint";
      }

      function appendText(parent, tag, text, className) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = text;
        parent.append(node);
        return node;
      }

      function displayUrl(rawUrl) {
        try {
          const parsed = new URL(rawUrl);
          return parsed.hostname + (parsed.pathname === "/" ? "" : parsed.pathname);
        } catch {
          return rawUrl;
        }
      }

      function decodeText(value) {
        return new DOMParser().parseFromString(String(value || ""), "text/html").body.textContent || "";
      }

      function renderResult(result) {
        const article = document.createElement("article");
        article.className = "result result-default category-general";
        const inner = document.createElement("div");
        inner.className = "result_inner";

        const urlHeader = document.createElement("a");
        urlHeader.className = "url_header";
        urlHeader.href = result.url;
        urlHeader.rel = "noreferrer";
        appendText(urlHeader, "div", displayUrl(result.url), "url_wrapper");
        inner.append(urlHeader);

        const heading = document.createElement("h3");
        const link = document.createElement("a");
        link.href = result.url;
        link.rel = "noreferrer";
        link.textContent = decodeText(result.title) || result.url;
        heading.append(link);
        inner.append(heading);

        appendText(
          inner,
          "p",
          result.content ? decodeText(result.content) : "This site did not provide any description.",
          result.content ? "content" : "content empty_element",
        );
        article.append(inner);

        const engines = document.createElement("div");
        engines.className = "engines";
        const providerNames = Array.isArray(result.engines) ? result.engines : [];
        for (const engine of providerNames) appendText(engines, "span", engine);
        article.append(engines);
        article.append(document.createElement("div"));
        article.lastElementChild.className = "break";
        return article;
      }

      function renderResponse(payload) {
        urls.replaceChildren();
        const results = Array.isArray(payload.results) ? payload.results : [];
        for (const result of results) urls.append(renderResult(result));

        if (results.length === 0) {
          appendText(urls, "p", "No results found. Try another query or engine.", "cf-empty");
        }

        const providers = [...new Set(results.flatMap((result) => result.engines || []))];
        resultCount.textContent = results.length + " results" + (providers.length ? " from " + providers.join(", ") : "");
        previousPage.disabled = state.page === 1;
        pagination.hidden = results.length === 0;
      }

      function search(query, page = 1, engine = homeEngine.value) {
        const normalized = query.trim();
        if (!normalized) return;
        const parameters = new URLSearchParams({
          q: normalized,
          pageno: String(page),
          engines: engine,
        });
        location.assign("/search?" + parameters);
      }
      previousPage.addEventListener("click", () => search(state.query, Math.max(1, state.page - 1), resultsEngine.value));
      nextPage.addEventListener("click", () => search(state.query, state.page + 1, resultsEngine.value));

      const initial = new URLSearchParams(location.search);
      const initialQuery = initial.get("q") || "";
      const initialPage = Number(initial.get("pageno") || "1");
      const initialEngine = initial.get("engines") || "";
      homeQuery.value = initialQuery;
      resultsQuery.value = initialQuery;
      if (["", "brave", "braveapi", "duckduckgo", "google cse"].includes(initialEngine)) {
        homeEngine.value = initialEngine;
        resultsEngine.value = initialEngine;
      }
      if (initialQuery) {
        state.query = initialQuery;
        state.page = Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1;
        state.engine = homeEngine.value;
        showResultsView();
        if (initialSearch && initialSearch.status < 400) {
          renderResponse(initialSearch.payload);
          hideStatus();
        } else {
          showStatus(initialSearch?.payload?.error || "Search failed", "error");
        }
      }
    })();
  </script>
</body>
</html>`;

function nonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function scriptData(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function searchUi({ braveApiConfigured = false, initialSearch = null } = {}) {
  const value = nonce();
  const body = PAGE
    .replaceAll("__NONCE__", value)
    .replaceAll("__INITIAL_SEARCH__", scriptData(initialSearch))
    .replaceAll("__BRAVE_API_DISABLED__", braveApiConfigured ? "" : "disabled")
    .replaceAll("__BRAVE_API_LABEL__", braveApiConfigured ? "" : " (not configured)");
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": [
        "default-src 'none'",
        "connect-src 'self'",
        "img-src 'self' data:",
        `script-src 'nonce-${value}'`,
        `style-src 'self' 'nonce-${value}'`,
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
