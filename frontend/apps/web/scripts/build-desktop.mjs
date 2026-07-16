/* global process */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "../../..");
const desktopPackagePath = resolve(frontendRoot, "apps/desktop/package.json");
const nextCli = resolve(frontendRoot, "node_modules/next/dist/bin/next");
const desktopPackage = JSON.parse(readFileSync(desktopPackagePath, "utf8"));

const result = spawnSync(process.execPath, [nextCli, "build"], {
  env: {
    ...process.env,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? desktopPackage.version,
    NEXT_PUBLIC_RELEASE_CHANNEL: process.env.NEXT_PUBLIC_RELEASE_CHANNEL ?? process.env.WEBTUI_RELEASE_CHANNEL ?? "stable",
    TAURI_BUILD: "1"
  },
  stdio: "inherit"
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
}

process.exit(result.status ?? 1);
