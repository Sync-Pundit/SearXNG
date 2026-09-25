import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cloudflareRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(cloudflareRoot, "..");
const outputRoot = resolve(cloudflareRoot, ".assets");
const themeSource = resolve(repositoryRoot, "searx/static/themes/simple");
const themeOutput = resolve(outputRoot, "static/themes/simple");

await rm(outputRoot, { force: true, recursive: true });
await mkdir(dirname(themeOutput), { recursive: true });
await cp(themeSource, themeOutput, { recursive: true });
await cp(resolve(cloudflareRoot, "static"), outputRoot, { recursive: true });
