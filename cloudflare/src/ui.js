const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>SearXNG Cloudflare search lab</title>
  <style nonce="__NONCE__">
    :root {
      color-scheme: dark;
      --bg: #071018;
      --panel: rgba(14, 28, 40, 0.88);
      --panel-strong: #0e1c28;
      --line: rgba(148, 190, 214, 0.17);
      --line-strong: rgba(71, 215, 255, 0.38);
      --text: #eef8fc;
      --muted: #91aaba;
      --accent: #47d7ff;
      --accent-strong: #0bb9ed;
      --good: #67e4a6;
      --bad: #ff8096;
      --warn: #ffd274;
      --shadow: 0 30px 80px rgba(0, 0, 0, 0.36);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at 12% 8%, rgba(11, 185, 237, 0.16), transparent 30rem),
        radial-gradient(circle at 88% 16%, rgba(103, 228, 166, 0.08), transparent 24rem),
        linear-gradient(150deg, #061018 0%, #09131d 55%, #071018 100%);
    }

    body::before {
      position: fixed;
      inset: 0;
      pointer-events: none;
      content: "";
      opacity: 0.18;
      background-image:
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
      background-size: 42px 42px;
      mask-image: linear-gradient(to bottom, black, transparent 72%);
    }

    button, input { font: inherit; }

    button, a { -webkit-tap-highlight-color: transparent; }

    .shell {
      position: relative;
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 56px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 58px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: -0.02em;
      font-weight: 720;
    }

    .mark {
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border: 1px solid var(--line-strong);
      border-radius: 11px;
      color: var(--accent);
      background: rgba(71, 215, 255, 0.08);
      box-shadow: inset 0 0 20px rgba(71, 215, 255, 0.05);
      font-size: 13px;
      letter-spacing: 0.08em;
    }

    .environment {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .pulse {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--good);
      box-shadow: 0 0 14px var(--good);
    }

    .intro { max-width: 780px; }

    .eyebrow {
      margin: 0 0 12px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    h1 {
      max-width: 720px;
      margin: 0;
      font-size: clamp(38px, 6vw, 70px);
      line-height: 0.99;
      letter-spacing: -0.055em;
    }

    .lede {
      max-width: 660px;
      margin: 24px 0 0;
      color: var(--muted);
      font-size: clamp(16px, 2vw, 19px);
      line-height: 1.65;
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 290px;
      gap: 20px;
      margin-top: 44px;
      align-items: start;
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }

    .search-panel { padding: clamp(20px, 4vw, 32px); }

    .field-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: end;
    }

    .query-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 94px auto;
      gap: 10px;
      align-items: end;
      margin-top: 22px;
    }

    label {
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 680;
      letter-spacing: 0.055em;
      text-transform: uppercase;
    }

    input {
      width: 100%;
      min-height: 48px;
      border: 1px solid var(--line);
      border-radius: 12px;
      outline: none;
      color: var(--text);
      background: rgba(5, 15, 23, 0.76);
      padding: 0 14px;
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }

    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(71, 215, 255, 0.12);
    }

    .button {
      min-height: 48px;
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 0 18px;
      cursor: pointer;
      font-weight: 720;
      transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }

    .button:hover:not(:disabled) { transform: translateY(-1px); }
    .button:active:not(:disabled) { transform: translateY(0); }
    .button:disabled { cursor: not-allowed; opacity: 0.48; }

    .primary {
      color: #02131b;
      background: var(--accent);
      box-shadow: 0 8px 28px rgba(11, 185, 237, 0.22);
    }

    .primary:hover:not(:disabled) { background: #7be4ff; }

    .secondary {
      color: var(--text);
      border-color: var(--line);
      background: rgba(255, 255, 255, 0.035);
    }

    .secondary:hover:not(:disabled) { border-color: var(--line-strong); }

    .token-actions { display: flex; gap: 8px; }

    .examples {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 18px;
    }

    .example {
      min-height: 32px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0 12px;
      cursor: pointer;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.025);
      font-size: 12px;
    }

    .example:hover { color: var(--text); border-color: var(--line-strong); }

    .privacy-note {
      display: flex;
      gap: 9px;
      margin: 12px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .privacy-note strong { color: var(--good); font-weight: 700; }

    .side-panel { padding: 22px; }

    .side-panel h2 {
      margin: 0 0 18px;
      font-size: 13px;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .facts {
      display: grid;
      gap: 16px;
      margin: 0;
    }

    .fact {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--line);
    }

    .fact:last-child { padding-bottom: 0; border-bottom: 0; }
    .fact dt { color: var(--muted); font-size: 12px; }
    .fact dd { margin: 0; font-size: 12px; font-weight: 680; text-align: right; }

    .status-wrap {
      display: none;
      margin-top: 20px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 12px;
      color: var(--muted);
      background: rgba(5, 15, 23, 0.55);
      font-size: 13px;
      line-height: 1.45;
    }

    .status-wrap.visible { display: flex; align-items: center; gap: 10px; }
    .status-wrap.error { color: #ffd5dc; border-color: rgba(255, 128, 150, 0.38); background: rgba(96, 17, 35, 0.18); }
    .status-wrap.success { color: #c8f9df; border-color: rgba(103, 228, 166, 0.32); }

    .spinner {
      width: 16px;
      height: 16px;
      flex: 0 0 auto;
      border: 2px solid rgba(71, 215, 255, 0.22);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 700ms linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .results-section { margin-top: 42px; }

    .results-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 16px;
    }

    .results-head h2 { margin: 0; font-size: 22px; letter-spacing: -0.025em; }
    .results-meta { color: var(--muted); font-size: 13px; }

    .results { display: grid; gap: 12px; }

    .result {
      display: grid;
      gap: 9px;
      padding: 20px 22px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(12, 25, 36, 0.72);
      transition: border-color 140ms ease, background 140ms ease;
    }

    .result:hover { border-color: var(--line-strong); background: rgba(14, 30, 43, 0.9); }

    .result-url {
      overflow: hidden;
      color: var(--good);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .result-title {
      width: fit-content;
      color: var(--text);
      font-size: 18px;
      font-weight: 720;
      line-height: 1.35;
      text-decoration-color: rgba(71, 215, 255, 0.35);
      text-underline-offset: 4px;
    }

    .result-title:hover { color: var(--accent); }

    .result-snippet { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }

    .result-footer { display: flex; align-items: center; gap: 8px; margin-top: 3px; }

    .tag {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 8px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .empty {
      padding: 36px 22px;
      border: 1px dashed var(--line);
      border-radius: 16px;
      color: var(--muted);
      text-align: center;
    }

    .pagination {
      display: none;
      justify-content: space-between;
      gap: 12px;
      margin-top: 18px;
    }

    .pagination.visible { display: flex; }

    @media (max-width: 820px) {
      .topbar { margin-bottom: 42px; }
      .workspace { grid-template-columns: 1fr; }
      .side-panel { order: -1; }
      .facts { grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .fact { display: block; padding: 0 10px 0 0; border: 0; border-right: 1px solid var(--line); }
      .fact:last-child { border-right: 0; }
      .fact dd { margin-top: 5px; text-align: left; }
    }

    @media (max-width: 620px) {
      .shell { width: min(100% - 22px, 1180px); padding-top: 18px; }
      .topbar { align-items: flex-start; }
      .environment { margin-top: 10px; font-size: 10px; }
      .field-row, .query-row { grid-template-columns: 1fr; }
      .token-actions { display: grid; grid-template-columns: 1fr 1fr; }
      .button { width: 100%; }
      .query-row .primary { margin-top: 2px; }
      .facts { grid-template-columns: 1fr; }
      .fact { display: grid; padding: 0 0 12px; border-right: 0; border-bottom: 1px solid var(--line); }
      .fact dd { margin: 0; text-align: right; }
      .results-head { align-items: flex-start; flex-direction: column; }
      .result { padding: 18px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand"><span class="mark">SX</span><span>SearXNG search lab</span></div>
      <div class="environment"><span class="pulse" aria-hidden="true"></span>Cloudflare Worker</div>
    </header>

    <section class="intro">
      <p class="eyebrow">Compatibility spike 02</p>
      <h1>Run the same dorks Threat Hunter sends.</h1>
      <p class="lede">Query DuckDuckGo through the Cloudflare Worker, inspect normalized SearXNG results, and verify pagination without touching the retired server stack.</p>
    </section>

    <section class="workspace" aria-label="Search workspace">
      <section class="panel search-panel" id="search-form" role="search">
        <div class="field-row">
          <label for="token">Worker token
            <input id="token" name="spike-auth-token" type="password" autocomplete="new-password" spellcheck="false" placeholder="Paste SPIKE_AUTH_TOKEN" aria-required="true" data-1p-ignore data-bwignore="true">
          </label>
          <div class="token-actions">
            <button class="button secondary" id="toggle-token" type="button">Show</button>
            <button class="button secondary" id="clear-token" type="button">Clear</button>
          </div>
        </div>
        <p class="privacy-note"><strong>Tab only.</strong> The token stays in session storage and is sent only to this Worker.</p>

        <div class="query-row">
          <label for="query">Search query
            <input id="query" name="q" type="search" maxlength="499" placeholder='site:github.io "metamask"' aria-required="true">
          </label>
          <label for="page">Page
            <input id="page" name="pageno" type="number" min="1" step="1" value="1" aria-required="true">
          </label>
          <button class="button primary" id="submit" type="button">Run search</button>
        </div>

        <div class="examples" aria-label="Example queries">
          <button class="example" type="button" data-query='site:github.io "metamask"'>GitHub Pages dork</button>
          <button class="example" type="button" data-query='site:pages.dev "wallet"'>Cloudflare Pages dork</button>
          <button class="example" type="button" data-query="Cloudflare Workers search">Plain query</button>
        </div>

        <div class="status-wrap" id="status" role="status" aria-live="polite"></div>
      </section>

      <aside class="panel side-panel" aria-label="Runtime facts">
        <h2>Request path</h2>
        <dl class="facts">
          <div class="fact"><dt>Runtime</dt><dd>Cloudflare</dd></div>
          <div class="fact"><dt>Provider</dt><dd>DuckDuckGo HTML</dd></div>
          <div class="fact"><dt>Output</dt><dd>SearXNG JSON</dd></div>
        </dl>
      </aside>
    </section>

    <section class="results-section" id="results-section" hidden>
      <div class="results-head">
        <h2>Search results</h2>
        <div class="results-meta" id="results-meta"></div>
      </div>
      <div class="results" id="results"></div>
      <div class="pagination" id="pagination">
        <button class="button secondary" id="previous" type="button">Previous page</button>
        <button class="button secondary" id="next" type="button">Next page</button>
      </div>
    </section>
  </main>

  <script nonce="__NONCE__">
    (() => {
      const form = document.querySelector("#search-form");
      const token = document.querySelector("#token");
      const query = document.querySelector("#query");
      const page = document.querySelector("#page");
      const submit = document.querySelector("#submit");
      const status = document.querySelector("#status");
      const resultsSection = document.querySelector("#results-section");
      const results = document.querySelector("#results");
      const resultsMeta = document.querySelector("#results-meta");
      const pagination = document.querySelector("#pagination");
      const previous = document.querySelector("#previous");
      const next = document.querySelector("#next");
      const storageKey = "searxng-spike-token";

      try { token.value = sessionStorage.getItem(storageKey) || ""; } catch {}

      const initial = new URL(location.href);
      query.value = initial.searchParams.get("q") || "";
      page.value = initial.searchParams.get("pageno") || "1";

      function setStatus(message, state = "", loading = false) {
        status.replaceChildren();
        status.className = "status-wrap visible" + (state ? " " + state : "");
        if (loading) {
          const spinner = document.createElement("span");
          spinner.className = "spinner";
          spinner.setAttribute("aria-hidden", "true");
          status.append(spinner);
        }
        status.append(document.createTextNode(message));
      }

      function safeUrl(value) {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
        } catch {
          return null;
        }
      }

      function resultCard(item) {
        const card = document.createElement("article");
        card.className = "result";
        const parsed = safeUrl(item.url);

        const address = document.createElement("div");
        address.className = "result-url";
        address.textContent = parsed ? parsed.hostname + parsed.pathname : "Invalid result URL";
        card.append(address);

        const title = document.createElement(parsed ? "a" : "span");
        title.className = "result-title";
        title.textContent = item.title || item.url || "Untitled result";
        if (parsed) {
          title.href = parsed.href;
          title.target = "_blank";
          title.rel = "noopener noreferrer";
        }
        card.append(title);

        if (item.content) {
          const snippet = document.createElement("p");
          snippet.className = "result-snippet";
          snippet.textContent = item.content;
          card.append(snippet);
        }

        const footer = document.createElement("footer");
        footer.className = "result-footer";
        for (const engine of Array.isArray(item.engines) ? item.engines : []) {
          const tag = document.createElement("span");
          tag.className = "tag";
          tag.textContent = engine;
          footer.append(tag);
        }
        if (Number.isFinite(item.score)) {
          const score = document.createElement("span");
          score.className = "tag";
          score.textContent = "score " + item.score.toFixed(3);
          footer.append(score);
        }
        card.append(footer);
        return card;
      }

      function render(payload, elapsedMs) {
        results.replaceChildren();
        const rows = Array.isArray(payload.results) ? payload.results : [];
        resultsSection.hidden = false;
        resultsMeta.textContent = rows.length + (rows.length === 1 ? " result" : " results") + " · page " + page.value + " · " + elapsedMs + " ms";

        if (rows.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "No results returned for this query.";
          results.append(empty);
        } else {
          results.append(...rows.map(resultCard));
        }

        previous.disabled = Number(page.value) <= 1;
        pagination.classList.add("visible");
      }

      async function runSearch() {
        const bearer = token.value.trim();
        const searchQuery = query.value.trim();
        const pageNumber = Number(page.value);

        if (!bearer) {
          setStatus("Paste the current Worker token before running a search.", "error");
          token.focus();
          return;
        }
        if (!searchQuery || !Number.isInteger(pageNumber) || pageNumber < 1) {
          setStatus("Enter a query and a positive page number.", "error");
          return;
        }

        try { sessionStorage.setItem(storageKey, bearer); } catch {}
        const url = new URL("/search", location.origin);
        url.searchParams.set("q", searchQuery);
        url.searchParams.set("format", "json");
        url.searchParams.set("pageno", String(pageNumber));
        history.replaceState(null, "", "/?q=" + encodeURIComponent(searchQuery) + "&pageno=" + pageNumber);

        submit.disabled = true;
        setStatus("Cloudflare is querying DuckDuckGo…", "", true);
        const started = performance.now();

        try {
          const response = await fetch(url, {
            headers: { Authorization: "Bearer " + bearer },
          });
          const payload = await response.json();
          const elapsedMs = Math.round(performance.now() - started);

          if (!response.ok) {
            const provider = Array.isArray(payload.unresponsive_engines)
              ? payload.unresponsive_engines.map((entry) => entry.join(": ")).join(", ")
              : "";
            const detail = provider || payload.error || ("HTTP " + response.status);
            setStatus("Search failed: " + detail, "error");
            resultsSection.hidden = true;
            return;
          }

          render(payload, elapsedMs);
          setStatus("Search completed on Cloudflare.", "success");
        } catch (error) {
          setStatus("The Worker could not complete the request: " + error.message, "error");
          resultsSection.hidden = true;
        } finally {
          submit.disabled = false;
        }
      }

      form.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearch();
        }
      });

      submit.addEventListener("click", runSearch);

      document.querySelector("#toggle-token").addEventListener("click", (event) => {
        const reveal = token.type === "password";
        token.type = reveal ? "text" : "password";
        event.currentTarget.textContent = reveal ? "Hide" : "Show";
      });

      document.querySelector("#clear-token").addEventListener("click", () => {
        token.value = "";
        try { sessionStorage.removeItem(storageKey); } catch {}
        token.focus();
      });

      for (const example of document.querySelectorAll("[data-query]")) {
        example.addEventListener("click", () => {
          query.value = example.dataset.query;
          page.value = "1";
          query.focus();
        });
      }

      previous.addEventListener("click", () => {
        page.value = String(Math.max(1, Number(page.value) - 1));
        runSearch();
      });

      next.addEventListener("click", () => {
        page.value = String(Number(page.value) + 1);
        runSearch();
      });
    })();
  </script>
</body>
</html>`;

export function searchUi() {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  return new Response(PAGE.replaceAll("__NONCE__", nonce), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": [
        "default-src 'none'",
        "base-uri 'none'",
        "connect-src 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "img-src data:",
        `script-src 'nonce-${nonce}'`,
        `style-src 'nonce-${nonce}'`,
      ].join("; "),
      "Content-Type": "text/html; charset=utf-8",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
