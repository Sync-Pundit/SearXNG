const PROVIDER_TARGETS = Object.freeze({
  "/brave": "https://api.search.brave.com/res/v1/web/search",
  "/serper": "https://google.serper.dev/search",
});

export async function proxyFallbackProvider(request, fetcher = fetch) {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname === "/diagnostic") {
    console.log(JSON.stringify({
      event: "fallback_diagnostic",
      stage: request.headers.get("X-Fallback-Stage") || "unknown",
    }));
    return new Response(null, { status: 204 });
  }
  const providerUrl = PROVIDER_TARGETS[requestUrl.pathname];
  if (!providerUrl) {
    return new Response("Fallback provider not found", { status: 404 });
  }

  const target = new URL(providerUrl);
  target.search = requestUrl.search;
  const response = await fetcher(new Request(target, request));
  console.log(JSON.stringify({
    event: "fallback_provider",
    provider: requestUrl.pathname.slice(1),
    status: response.status,
  }));
  return response;
}
