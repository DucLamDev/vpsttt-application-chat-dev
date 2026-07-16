/* global process */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, "..");
const frontendRoot = resolve(desktopRoot, "../..");
const generatedDir = resolve(desktopRoot, "src-tauri/.generated");
const releaseConfigPath = resolve(generatedDir, "tauri.release.conf.json");
const desktopPackage = JSON.parse(readFileSync(resolve(desktopRoot, "package.json"), "utf8"));

const channel = normalizeChannel(process.env.WEBTUI_RELEASE_CHANNEL ?? process.env.NEXT_PUBLIC_RELEASE_CHANNEL ?? "stable");
const updaterPublicKey = requiredEnv("WEBTUI_TAURI_UPDATER_PUBKEY");
const signingPrivateKey = process.env.TAURI_SIGNING_PRIVATE_KEY ?? process.env.TAURI_SIGNING_PRIVATE_KEY_PATH;

if (!signingPrivateKey) {
  fail("Missing TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH for signed updater artifacts.");
}

const bundles = parseCsv(process.env.WEBTUI_TAURI_BUNDLES) ?? defaultBundlesForPlatform(process.platform);
const updaterEndpoint =
  process.env.WEBTUI_UPDATER_ENDPOINT ??
  `https://chat.vpsttt.com/desktop/releases/${channel}/{{target}}/{{arch}}/{{current_version}}`;

mkdirSync(generatedDir, { recursive: true });
writeFileSync(
  releaseConfigPath,
  `${JSON.stringify(
    {
      bundle: {
        active: true,
        createUpdaterArtifacts: true,
        targets: bundles,
        publisher: "VPSTTT",
        windows: {
          certificateThumbprint: process.env.WEBTUI_WINDOWS_CERT_THUMBPRINT || null,
          digestAlgorithm: "sha256",
          timestampUrl: process.env.WEBTUI_WINDOWS_TIMESTAMP_URL || "http://timestamp.digicert.com",
          tsp: false,
          webviewInstallMode: {
            silent: true,
            type: "downloadBootstrapper"
          }
        }
      },
      plugins: {
        updater: {
          endpoints: [updaterEndpoint],
          pubkey: updaterPublicKey
        }
      },
      version: process.env.WEBTUI_DESKTOP_VERSION ?? desktopPackage.version
    },
    null,
    2
  )}\n`
);

const tauriArgs = ["--workspace", "@webtui/desktop", "run", "tauri", "--", "build", "--ci", "--config", releaseConfigPath];
if (bundles.length > 0) {
  tauriArgs.push("--bundles", bundles.join(","));
}
const targetTriple = process.env.WEBTUI_TAURI_TARGET ?? defaultTargetForPlatform(process.platform);
if (targetTriple) {
  tauriArgs.push("--target", targetTriple);
}

const env = {
  ...process.env,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.WEBTUI_DESKTOP_VERSION ?? desktopPackage.version,
  NEXT_PUBLIC_RELEASE_CHANNEL: channel,
  TAURI_BUILD: "1"
};

const result = spawnSync("npm", tauriArgs, {
  cwd: frontendRoot,
  env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
}

process.exit(result.status ?? 1);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Missing ${name}. Generate it with: npm --workspace @webtui/desktop run tauri -- signer generate --ci`);
  }
  return value;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function normalizeChannel(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized !== "stable" && normalized !== "beta") {
    fail("WEBTUI_RELEASE_CHANNEL must be stable or beta.");
  }
  return normalized;
}

function parseCsv(value) {
  const values = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values?.length ? values : null;
}

function defaultBundlesForPlatform(platform) {
  if (platform === "win32") {
    return ["msi", "nsis"];
  }
  if (platform === "darwin") {
    return ["dmg"];
  }
  return ["appimage", "deb"];
}

function defaultTargetForPlatform(platform) {
  return platform === "darwin" ? "universal-apple-darwin" : "";
}
