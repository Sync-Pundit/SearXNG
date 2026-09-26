import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const cloudflareRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(cloudflareRoot, "..");

function read(relativePath) {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} is missing: ${expected}`);
  }
}

const themes = [
  "paulgo",
  "latte",
  "frappe",
  "macchiato",
  "mocha",
  "kagi",
  "brave",
  "moa",
  "night",
  "dracula",
  "gruvbox",
  "gruvboxmat",
  "everforest",
  "evergarden",
  "nord",
  "matcha",
];

const styleChoices = read("searx/settings_defaults.py");
const compiledTheme = read("searx/static/themes/simple/sxng-ltr.min.css");
const themeImports = read("client/simple/src/less/custom-themes.less");
for (const theme of themes) {
  requireText(styleChoices, `'${theme}'`, `theme preference ${theme}`);
  requireText(themeImports, `themes/${theme}.less`, `theme source ${theme}`);
  requireText(compiledTheme, `theme-${theme}`, `compiled theme ${theme}`);
}

const settings = read("cloudflare/container/settings.yml");
requireText(settings, "use_default_settings: true", "upstream settings inheritance");
requireText(settings, "image_proxy: true", "Cloudflare image proxy");
requireText(settings, "method: GET", "edge-classifiable search method");
requireText(settings, "name: braveapi", "Brave API engine");
requireText(settings, "name: brave", "Brave HTML engine");
requireText(settings, "name: yahoo", "Yahoo engine override");
requireText(settings, "name: braveapi\n    inactive: true", "Brave API direct-engine denial");
for (const engine of [
  "brave",
  "duckduckgo",
  "google",
  "google cse",
  "wikipedia",
  "yandex",
  "yahoo",
]) {
  requireText(settings, `name: ${engine}\n    inactive: false`, `${engine} activation`);
}
for (const engine of ["dogpile", "dogpile images"]) {
  requireText(
    settings,
    `name: ${engine}\n    inactive: false\n    disabled: true`,
    `${engine} opt-in availability`,
  );
}

const defaultEngines = read("searx/settings.yml");
for (const engine of ["findborg", "iconify", "xprivo", "braveapi"]) {
  requireText(defaultEngines, `name: ${engine}`, `engine catalog entry ${engine}`);
}

const worker = read("cloudflare/src/index.js");
requireText(worker, "SEARXNG_SECRET", "Container session secret binding");
requireText(worker, "BRAVE_API_KEY", "Brave API fallback secret binding");
requireText(worker, "SERPER_API_KEY", "Serper fallback secret binding");
requireText(worker, "dogpile,dogpile images", "Dogpile API fallback gate");
requireText(worker, '"api-fallback.internal": proxyFallbackProvider', "Worker-side API fallback egress");
if (worker.includes("interceptHttps = true")) {
  throw new Error("Official API fallback proxy must not enable global HTTPS interception");
}
const yahoo = read("searx/engines/yahoo.py");
requireText(yahoo, 'CACHE.get("YBV")', "Yahoo parent-domain cookie cache");
requireText(yahoo, '"search.yahoo.com"', "Yahoo global-edge recovery");
const router = read("cloudflare/src/router.js");
requireText(router, "SEARXNG_AUTH_TOKEN", "machine JSON bearer gate");

const fallbackPlugin = read("searx/plugins/serper_fallback.py");
requireText(fallbackPlugin, "serper_api_key", "per-browser Serper key override");
requireText(fallbackPlugin, "brave_api_key", "per-browser Brave key override");
const preferences = read("searx/preferences.py");
requireText(preferences, "class SecretSetting", "hardened API key preference");
requireText(preferences, "isinstance(v, SecretSetting)", "secret preference URL exclusion");

const wrangler = read("cloudflare/wrangler.jsonc");
if (/constraints|regions/.test(wrangler)) {
  throw new Error("Cloudflare Container placement must not be region constrained");
}

console.log(`Cloudflare migration parity passed (${themes.length} additional themes)`);
