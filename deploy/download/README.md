# Download Host Artifacts

`download.vpsttt.com` publishes signed release artifacts only. The current scope
is Android direct download first; Google Play links are added later through the
manifest `store_url`.

## Static Page

- `index.html`: Android download entrypoint.
- `styles.css`: responsive visual design.
- `app.js`: reads release metadata.
- `assets/android-chat-preview.png`: mobile UI preview used on the page.
- `privacy.html`: minimal privacy/support page for the Android channel.

## Expected Android Files

Publish CI release artifacts under the host path below:

- `android/stable/app-prod-release.apk`
- `android/stable/app-prod-release.apk.sha256`
- `android/stable/mobile-release-manifest.json`

The manifest format mirrors the M11 workflow artifact and the backend
`/mobile/releases/{platform}/{channel}/{current_version}` response.

Never upload keystores, `key.properties`, Firebase service account files,
private tester lists, or any secret material to this host.
