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

const defaultEngines = read("searx/settings.yml");
for (const engine of ["findborg", "iconify", "xprivo", "braveapi"]) {
  requireText(defaultEngines, `name: ${engine}`, `engine catalog entry ${engine}`);
}

const worker = read("cloudflare/src/index.js");
requireText(worker, "SEARXNG_SECRET", "Container session secret binding");
const router = read("cloudflare/src/router.js");
requireText(router, "SEARXNG_AUTH_TOKEN", "machine JSON bearer gate");

const wrangler = read("cloudflare/wrangler.jsonc");
if (/constraints|regions/.test(wrangler)) {
  throw new Error("Cloudflare Container placement must not be region constrained");
}

console.log(`Cloudflare migration parity passed (${themes.length} additional themes)`);
