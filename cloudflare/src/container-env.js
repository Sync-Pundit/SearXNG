const DEFAULT_BASE_URL = "https://searxng.pundit.workers.dev/";
const DEFAULT_PRIMARY_ENGINES = "google,google cse,dogpile,dogpile images,yahoo";

export function containerEnv(workerEnv) {
  return {
    BRAVE_API_KEY: workerEnv.BRAVE_API_KEY || "",
    FALLBACK_PROXY_BASE: "http://api-fallback.internal",
    SEARXNG_BASE_URL: workerEnv.SEARXNG_BASE_URL || DEFAULT_BASE_URL,
    SEARXNG_SECRET: workerEnv.SEARXNG_SECRET || "",
    SERPER_API_KEY: workerEnv.SERPER_API_KEY || "",
    SERPER_MAX_PAGE: workerEnv.SERPER_MAX_PAGE || "5",
    SERPER_PRIMARY_ENGINES: workerEnv.SERPER_PRIMARY_ENGINES || DEFAULT_PRIMARY_ENGINES,
  };
}
