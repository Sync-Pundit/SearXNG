import { Container, getContainer } from "@cloudflare/containers";

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
}

export default {
  fetch(request, workerEnv) {
    const container = getContainer(workerEnv.SEARXNG_CONTAINER, "primary");
    return routeRequest(request, workerEnv, () => container);
  },
};
