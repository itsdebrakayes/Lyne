import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const projectDirectory = fileURLToPath(new URL("./", import.meta.url));
const websiteDirectory = resolve(projectDirectory, "apps/website");
const staleWebsiteModules = resolve(websiteDirectory, "node_modules");

// GoDaddy installs this repository as one root Node application. Older
// workspace-based deployments can leave a partial nested install behind, so
// remove only that obsolete cache before Vite resolves the website imports.
await rm(staleWebsiteModules, {
  force: true,
  maxRetries: 5,
  recursive: true,
  retryDelay: 250,
});

// Tailwind and PostCSS discover their configuration from the current working
// directory, even when Vite receives an explicit root through its API.
process.chdir(websiteDirectory);
await build({ root: websiteDirectory });
