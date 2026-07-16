/* global process */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, "..");
const desktopPackage = JSON.parse(readFileSync(resolve(desktopRoot, "package.json"), "utf8"));

const manifestRoot = requiredEnv("WEBTUI_DESKTOP_MANIFEST_DIR");
const channel = normalizeChannel(process.env.WEBTUI_RELEASE_CHANNEL ?? "stable");
const target = safePart(process.env.WEBTUI_TAURI_TARGET ?? defaultTargetForPlatform(process.platform), "WEBTUI_TAURI_TARGET");
const arch = safePart(process.env.WEBTUI_TAURI_ARCH ?? process.arch, "WEBTUI_TAURI_ARCH");
const version = process.env.WEBTUI_DESKTOP_VERSION ?? desktopPackage.version;
const artifactUrl = requiredEnv("WEBTUI_RELEASE_ARTIFACT_URL");
const signature = requiredEnv("WEBTUI_RELEASE_SIGNATURE");
const notes = process.env.WEBTUI_RELEASE_NOTES ?? `WebTui Chat ${version}`;
const pubDate = process.env.WEBTUI_RELEASE_PUB_DATE ?? new Date().toISOString();
const platformKey = process.env.WEBTUI_UPDATER_PLATFORM_KEY ?? target;

const manifestDir = resolve(manifestRoot, channel, target, arch);
mkdirSync(manifestDir, { recursive: true });
writeFileSync(
  resolve(manifestDir, "latest.json"),
  `${JSON.stringify(
    {
      version,
      notes,
      pub_date: pubDate,
      platforms: {
        [platformKey]: {
          signature,
          url: artifactUrl
        }
      }
    },
    null,
    2
  )}\n`
);

process.stdout.write(`Wrote updater manifest: ${resolve(manifestDir, "latest.json")}\n`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    process.stderr.write(`Missing ${name}.\n`);
    process.exit(1);
  }
  return value;
}

function normalizeChannel(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized !== "stable" && normalized !== "beta") {
    process.stderr.write("WEBTUI_RELEASE_CHANNEL must be stable or beta.\n");
    process.exit(1);
  }
  return normalized;
}

function safePart(value, envName) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._+-]+$/.test(normalized) || normalized.includes("..") || normalized === "." || normalized === "..") {
    process.stderr.write(`${envName} contains an unsafe path value.\n`);
    process.exit(1);
  }
  return normalized;
}

function defaultTargetForPlatform(platform) {
  if (platform === "win32") {
    return "windows-x86_64";
  }
  if (platform === "darwin") {
    return "darwin-universal";
  }
  return "linux-x86_64";
}
