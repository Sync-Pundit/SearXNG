import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

import { routeRequest } from "./router.js";

export { ContainerProxy } from "@cloudflare/containers";

async function proxyProviderRequest(request) {
  const response = await fetch(request);
  console.log(JSON.stringify({
    event: "provider_egress",
    host: new URL(request.url).hostname,
    status: response.status,
  }));
  return response;
}

export class SearxngContainer extends Container {
  defaultPort = 8080;
  enableInternet = true;
  interceptHttps = true;
  pingEndpoint = "container/healthz";
  requiredPorts = [8080];
  sleepAfter = "24h";
  envVars = {
    BRAVE_API_KEY: env.BRAVE_API_KEY || "",
    SEARXNG_BASE_URL: env.SEARXNG_BASE_URL || "https://searxng.pundit.workers.dev/",
    SEARXNG_SECRET: env.SEARXNG_SECRET || "",
    SERPER_API_KEY: env.SERPER_API_KEY || "",
    SERPER_MAX_PAGE: env.SERPER_MAX_PAGE || "5",
    SERPER_PRIMARY_ENGINES: env.SERPER_PRIMARY_ENGINES || "google,google cse",
  };
}

// @cloudflare/containers registers handlers through an inherited static
// setter. A native static class field shadows that setter, so assign after the
// class definition until the package fixes its ES2022 registration bug.
SearxngContainer.outboundByHost = {
  "www.dogpile.com": proxyProviderRequest,
  "www.google.com": proxyProviderRequest,
  "search.yahoo.com": proxyProviderRequest,
};

export default {
  fetch(request, workerEnv) {
    return routeRequest(request, workerEnv, () => (
      getContainer(workerEnv.SEARXNG_CONTAINER, "primary")
    ));
  },
};
