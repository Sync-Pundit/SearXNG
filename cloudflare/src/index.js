import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

import { routeRequest } from "./router.js";

export class SearxngContainer extends Container {
  defaultPort = 8080;
  enableInternet = true;
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

export default {
  fetch(request, workerEnv) {
    return routeRequest(request, workerEnv, () => (
      getContainer(workerEnv.SEARXNG_CONTAINER, "primary")
    ));
  },
};
