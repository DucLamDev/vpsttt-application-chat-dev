/* global process */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "../../..");
const nextCli = resolve(frontendRoot, "node_modules/next/dist/bin/next");

const result = spawnSync(process.execPath, [nextCli, "build"], {
  env: {
    ...process.env,
    TAURI_BUILD: "1"
  },
  stdio: "inherit"
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
}

process.exit(result.status ?? 1);
