import { Container, getContainer } from "@cloudflare/containers";

import { containerEnv } from "./container-env.js";
import { proxyFallbackProvider } from "./fallback-proxy.js";
import { routeRequest } from "./router.js";

// Retain the proxy entrypoint for Durable Objects that were previously
// configured for outbound interception. With no interception rules it is
// inactive, but Cloudflare requires the export while that state is retired.
export { ContainerProxy } from "@cloudflare/containers";

export class SearxngContainer extends Container {
  defaultPort = 8080;
  enableInternet = true;
  pingEndpoint = "container/healthz";
  requiredPorts = [8080];
  sleepAfter = "24h";

  constructor(ctx, workerEnv) {
    super(ctx, workerEnv);
    this.envVars = containerEnv(workerEnv);
    console.log(JSON.stringify({
      event: "container_environment",
      braveConfigured: Boolean(this.envVars.BRAVE_API_KEY),
      serperConfigured: Boolean(this.envVars.SERPER_API_KEY),
    }));
  }
}

SearxngContainer.outboundByHost = {
  "api-fallback.internal": proxyFallbackProvider,
};

export default {
  fetch(request, workerEnv) {
    return routeRequest(request, workerEnv, () => (
      getContainer(workerEnv.SEARXNG_CONTAINER, "primary")
    ));
  },
};
