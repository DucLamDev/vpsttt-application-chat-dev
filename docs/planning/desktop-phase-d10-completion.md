# Desktop App Phase D10 Completion

Ngay chot: 2026-07-14

Phase D10 hoan thien lop packaging, signing, updater channel va version compatibility cho desktop app. Source khong commit private signing key; release build chi chay khi secret/key duoc cap tu moi truong build.

## Ra soat Phase D9

| Hang muc | Ket luan |
|---|---|
| Offline cache/read mode | Giu trang thai xong: workspace/chat/timeline cache co schema version va offline banner. |
| Outbox/draft | Giu trang thai xong: text outbox + draft ton tai qua restart, retry bang `client_message_id`. |
| Idempotency backend | Giu trang thai xong: migration `000019_messages_client_message_id` va API `Idempotency-Key`. |
| Native smoke | Van bi chan boi may hien tai thieu `cargo`, nen Tauri native build dung o `cargo metadata`. |

## Ban giao D10

| Hang muc | Trang thai | Ghi chu |
|---|---:|---|
| D10.1 Windows MSI/NSIS | Xong | `build:release` mac dinh sinh `msi,nsis` tren Windows va van dung Next static export. |
| D10.2 Windows code signing | Xong | Release script nhan `WEBTUI_WINDOWS_CERT_THUMBPRINT`, SHA-256 digest va timestamp URL; khong release khi thieu updater signing secret. |
| D10.3 macOS universal/sign/notarize | Xong | Release script ho tro bundle `dmg` va mac dinh target `universal-apple-darwin`; signing/notarization chay qua Tauri/CI env cua runner macOS. |
| D10.4 Linux AppImage/deb | Xong | Release script mac dinh sinh `appimage,deb` tren Linux. |
| D10.5 Signed updater | Xong | Tauri updater plugin duoc khai bao; release overlay bat `bundle.createUpdaterArtifacts`; backend serve manifest signed theo channel/target/arch. |
| D10.6 Stable/beta channel | Xong | `WEBTUI_RELEASE_CHANNEL=stable|beta` duoc dua vao Next env, updater endpoint va manifest writer. |
| D10.7 Rollback/runbook | Xong | Desktop README co quy trinh key, release inputs va rollback manifest. |
| D10.8 Version compatibility | Xong | Backend `/version` tra `clients.desktop`; frontend Settings canh bao khi desktop thap hon minimum/recommended. |

## File chinh

- `frontend/apps/desktop/scripts/build-release.mjs`: sinh config release tam thoi, verify signing env va goi Tauri CLI voi bundles theo OS.
- `frontend/apps/desktop/scripts/write-updater-manifest.mjs`: sinh `latest.json` cho signed updater tu artifact URL va signature.
- `frontend/apps/desktop/src-tauri/src/lib.rs`: nap `tauri-plugin-updater`.
- `frontend/apps/desktop/src-tauri/capabilities/default.json`: them `updater:default`.
- `backend/internal/modules/health/delivery/http/handler.go`: `/version` tra desktop version policy va `/desktop/releases/{channel}/{target}/{arch}/{current_version}` serve updater manifest.
- `frontend/apps/web/src/features/platform/hooks/use-api-status.ts`: hook `useDesktopVersionStatus`.
- `frontend/apps/web/src/features/chat/components/chat-workspace.tsx`: Settings hien trang thai phien ban/cap nhat.

## Kiem thu can chay

```bash
go test ./internal/config ./internal/modules/health/...
npm.cmd run test:unit -- desktop-openapi-contract.test.ts
npm.cmd run typecheck
npm.cmd --workspace @webtui/web run lint
npm.cmd --workspace @webtui/web run build:desktop
npm.cmd --workspace @webtui/desktop run build:release
npm.cmd --workspace @webtui/desktop run write-updater-manifest
```

Ghi chu: `build:release` can Rust/Cargo, native SDK va signing secret. Tren may hien tai, native Tauri build van bi chan neu chua cai `cargo`.

Ket qua luot chay 2026-07-14:

- `go test ./internal/config ./internal/modules/health/...` pass.
- `go test ./internal/modules/messages/...` pass de xac nhan lai D9 idempotency.
- `npm.cmd run test:unit -- offline-cache.test.ts` pass de xac nhan lai D9 cache/outbox.
- `npm.cmd run test:unit -- desktop-openapi-contract.test.ts` pass.
- `npm.cmd run typecheck` pass.
- `npm.cmd --workspace @webtui/web run lint` pass.
- `npm.cmd --workspace @webtui/web run build:desktop` pass va sinh `/chat/desktop`.
- `npm.cmd --workspace @webtui/desktop run write-updater-manifest` pass voi env dummy trong workspace va sinh `latest.json` dung channel/target/arch.
- `npm.cmd --workspace @webtui/desktop run build:release` dung som dung thiet ke khi thieu `WEBTUI_TAURI_UPDATER_PUBKEY`.
- `npm.cmd --workspace @webtui/desktop run tauri -- build` van dung o `cargo metadata` vi may hien tai chua co `cargo`.

## Dieu kien chuyen D11

- Dua `WEBTUI_TAURI_UPDATER_PUBKEY`, `TAURI_SIGNING_PRIVATE_KEY` hoac `TAURI_SIGNING_PRIVATE_KEY_PATH` vao CI secret store.
- Chay release build tren Windows/macOS/Linux runner that de lay installer va updater artifact signed.
- Publish stable/beta updater manifest len thu muc `DESKTOP_RELEASE_MANIFEST_DIR` hoac storage duoc mount vao backend.
- Dat `DESKTOP_MIN_VERSION`, `DESKTOP_RECOMMENDED_VERSION`, `DESKTOP_UPDATE_URL` tren backend staging/production.
