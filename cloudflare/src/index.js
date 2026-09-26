import { Container, getContainer } from "@cloudflare/containers";

import { containerEnv } from "./container-env.js";
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
    super(ctx, workerEnv, { envVars: containerEnv(workerEnv) });
  }

  async probeProviders() {
    if (!this.ctx.container.running) {
      await this.start();
    }
    const process = await this.ctx.container.exec([
      "/usr/local/searxng/.venv/bin/python",
      "/usr/local/searxng/provider_probe.py",
    ]);
    const output = await process.output();
    if (output.exitCode !== 0) {
      throw new Error(`Provider acceptance probe exited with ${output.exitCode}`);
    }
    return JSON.parse(new TextDecoder().decode(output.stdout));
  }
}

export default {
  async fetch(request, workerEnv) {
    const container = getContainer(workerEnv.SEARXNG_CONTAINER, "primary");
    if (new URL(request.url).pathname === "/__provider-acceptance-2e2d277b7") {
      const results = await container.probeProviders();
      console.log(JSON.stringify({ event: "provider_acceptance", ...results }));
      return new Response(JSON.stringify(results), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }
    return routeRequest(request, workerEnv, () => container);
  },
};
