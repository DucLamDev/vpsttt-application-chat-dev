const fallbackManifest = {
  platform: "android",
  channel: "stable",
  version: "1.0.0",
  version_code: 100,
  download_url: "/downloads/files/android/stable/app-prod-release.apk",
  store_url: "",
  checksum_sha256: "replace-with-apk-sha256",
  release_notes: "Internal Android release."
};

const manifestCandidates = [
  "./android/stable/mobile-release-manifest.json",
  "./mobile-release-manifest.json",
  "./mobile-release-manifest.example.json"
];

const text = (id, value) => {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
};

const attr = (id, name, value) => {
  const node = document.getElementById(id);
  if (node && value) {
    node.setAttribute(name, value);
  }
};

async function fetchManifest() {
  for (const url of manifestCandidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return await response.json();
      }
    } catch (_) {
      // Static preview can run without a local server; fall back below.
    }
  }
  return fallbackManifest;
}

function renderManifest(manifest) {
  const version = manifest.version || manifest.current_version || "unknown";
  const versionCode = manifest.version_code || "-";
  const channel = manifest.channel || "stable";
  const checksum = manifest.checksum_sha256 || "SHA-256 pending";
  const releaseNotes = manifest.release_notes || "Chưa có ghi chú phát hành.";

  text("versionLabel", version);
  text("versionCodeLabel", String(versionCode));
  text("channelLabel", channel);
  text("checksumValue", checksum);
  text("releaseNotes", releaseNotes);
  attr("apkLink", "href", manifest.download_url || fallbackManifest.download_url);

  const storeLink = document.getElementById("storeLink");
  if (storeLink && manifest.store_url) {
    storeLink.href = manifest.store_url;
    storeLink.hidden = false;
  }
}

fetchManifest().then(renderManifest);
