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
    .cf-access {
      width: min(34rem, calc(100% - 2rem));
      margin: 0 auto 1rem;
      border: 1px solid var(--color-toolkit-dialog-border);
      border-radius: 10px;
      padding: 1rem;
      background: var(--color-toolkit-dialog-background);
    }
    .cf-access form { display: grid; gap: .75rem; }
    .cf-access label { font-weight: 700; }
    .cf-access-row { display: flex; gap: .5rem; }
    .cf-access-row input {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--color-search-border);
      border-radius: 10px;
      padding: .7rem;
      color: var(--color-search-font);
      background: var(--color-search-background);
    }
    .cf-access-row button {
      border: 0;
      border-radius: 10px;
      padding: .7rem 1rem;
      color: var(--color-btn-font);
      background: var(--color-btn-background);
      cursor: pointer;
    }
    .cf-access p, .cf-status { margin: 0; line-height: 1.5; }
    .cf-access p { color: var(--color-result-engines-font); font-size: .9rem; }
    .cf-status {
      border: 1px solid var(--color-result-border);
      border-radius: 10px;
      margin: 0 .5rem 1rem;
      padding: .8rem 1rem;
      background: var(--color-result-background);
    }
    .cf-status[data-kind="error"] { color: var(--color-error); border-color: var(--color-error); }
    .cf-status[data-kind="loading"] { color: var(--color-result-engines-font); }
    #links_on_top .cf-access-link {
      display: flex;
      width: auto;
      height: auto;
      align-items: center;
      gap: .35rem;
      border: 1px solid var(--color-header-border);
      border-radius: 10px;
      padding: .55rem .7rem;
      cursor: pointer;
      color: var(--color-base-font);
      background: var(--color-header-background);
      text-decoration: none;
    }
    #links_on_top .cf-access-link span { display: inline; }
    .cf-wordmark { display: block; width: 8rem; height: auto; }
    #main_index .cf-wordmark { width: min(21rem, 70vw); margin: 0 auto; }
    #main_results #search_logo { display: flex; align-items: center; }
    #main_results #search_logo .cf-wordmark { width: 8rem; }
    #main_results #search_logo .cf-mark { width: 3rem; }
    .cf-result-count { color: var(--color-result-engines-font); font-size: .9rem; }
    .cf-empty { margin: 1rem .5rem; }
    .cf-pagination-button[disabled] { opacity: .45; cursor: not-allowed; }
    @media screen and (max-width: 50em) {
      .cf-access-row { flex-direction: column; }
      #main_results #search_logo .cf-mark { width: 2.25rem; }
    }
  </style>
</head>
<body class="index_endpoint">
  <main id="main_index">
    <nav id="links_on_top">
      <a href="#cloudflare-access" id="access-link" class="link_on_top_preferences cf-access-link">
        <svg viewBox="0 0 512 512" class="sxng-icon-set-small" aria-hidden="true"><path d="M262.29 192.31a64 64 0 1 0 57.4 57.4 64.13 64.13 0 0 0-57.4-57.4M416.39 256a154 154 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.5 164.5 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22 155 155 0 0 1-21.46-12.57 16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.5 164.5 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22 155 155 0 0 1 21.46 12.57 16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg><span>Cloudflare access</span>
      </a>
    </nav>

    <section id="cloudflare-access" class="cf-access" hidden>
      <form id="access-form">
        <label for="token">Worker token</label>
        <div class="cf-access-row">
          <input id="token" name="token" type="password" autocomplete="off" spellcheck="false">
          <button type="submit">Save for this tab</button>
        </div>
        <p>The token stays in this tab's session storage and is sent only to this Worker.</p>
      </form>
    </section>

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
    <p>Powered by <a href="https://docs.searxng.org/">SearXNG</a> on Cloudflare — a privacy-respecting metasearch migration.</p>
  </footer>

  <script nonce="__NONCE__">
    (() => {
      const state = {
        page: 1,
        query: "",
        token: sessionStorage.getItem("searxng-worker-token") || "",
      };
      const main = document.querySelector("main");
      const homeView = document.getElementById("home-view");
      const resultsView = document.getElementById("results-view");
      const homeForm = document.getElementById("search");
      const resultsForm = document.getElementById("results-search");
      const homeQuery = document.getElementById("q");
      const resultsQuery = document.getElementById("q-results");
      const access = document.getElementById("cloudflare-access");
      const accessForm = document.getElementById("access-form");
      const tokenInput = document.getElementById("token");
      const status = document.getElementById("status");
      const urls = document.getElementById("urls");
      const resultCount = document.getElementById("result-count");
      const pagination = document.getElementById("pagination");
      const previousPage = document.getElementById("previous-page");
      const nextPage = document.getElementById("next-page");

      tokenInput.value = state.token;

      function showAccess(focus = false) {
        access.hidden = false;
        if (focus) tokenInput.focus();
      }

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
          appendText(urls, "p", "No results found. Try another query or provider.", "cf-empty");
        }

        const providers = [...new Set(results.flatMap((result) => result.engines || []))];
        resultCount.textContent = results.length + " results" + (providers.length ? " from " + providers.join(", ") : "");
        previousPage.disabled = state.page === 1;
        pagination.hidden = results.length === 0;
      }

      async function search(query, page = 1) {
        const normalized = query.trim();
        if (!normalized) return;
        if (!state.token) {
          showAccess(true);
          showStatus("Add the Worker token to search from this tab.", "error");
          showResultsView();
          return;
        }

        state.query = normalized;
        state.page = page;
        homeQuery.value = normalized;
        resultsQuery.value = normalized;
        showResultsView();
        showStatus("Searching providers...");
        urls.replaceChildren();
        pagination.hidden = true;
        resultCount.textContent = "";

        const parameters = new URLSearchParams({ q: normalized, format: "json", pageno: String(page) });
        history.replaceState(null, "", "/?q=" + encodeURIComponent(normalized) + "&pageno=" + page);

        try {
          const response = await fetch("/search?" + parameters, {
            headers: { Authorization: "Bearer " + state.token },
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Search failed with HTTP " + response.status);
          renderResponse(payload);
          hideStatus();
        } catch (error) {
          showStatus(error instanceof Error ? error.message : "Search failed", "error");
        }
      }

      document.getElementById("access-link").addEventListener("click", (event) => {
        event.preventDefault();
        access.hidden = !access.hidden;
        if (!access.hidden) tokenInput.focus();
      });

      accessForm.addEventListener("submit", (event) => {
        event.preventDefault();
        state.token = tokenInput.value.trim();
        if (state.token) sessionStorage.setItem("searxng-worker-token", state.token);
        else sessionStorage.removeItem("searxng-worker-token");
        access.hidden = true;
        if (state.query) search(state.query, state.page);
        else homeQuery.focus();
      });

      homeForm.addEventListener("submit", (event) => {
        event.preventDefault();
        search(homeQuery.value, 1);
      });
      resultsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        search(resultsQuery.value, 1);
      });
      previousPage.addEventListener("click", () => search(state.query, Math.max(1, state.page - 1)));
      nextPage.addEventListener("click", () => search(state.query, state.page + 1));

      const initial = new URLSearchParams(location.search);
      const initialQuery = initial.get("q") || "";
      const initialPage = Number(initial.get("pageno") || "1");
      homeQuery.value = initialQuery;
      resultsQuery.value = initialQuery;
      if (initialQuery && state.token) search(initialQuery, Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1);
    })();
  </script>
</body>
</html>`;

function nonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function searchUi() {
  const value = nonce();
  const body = PAGE.replaceAll("__NONCE__", value);
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
