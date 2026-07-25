#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker/compose.prod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.compose.env}"
export COMPOSE_DISABLE_ENV_FILE=1
API_HEALTH_URL="${API_HEALTH_URL:-http://localhost/ready}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-5}"

if [ ! -f ".env" ]; then
  echo "Missing production .env in deploy directory." >&2
  exit 1
fi

read_env_value() {
  key="$1"
  sed -n "s/^$key=//p" .env | tail -n 1
}

export API_DOMAIN="${API_DOMAIN:-$(read_env_value API_DOMAIN)}"
export API_DOMAIN="${API_DOMAIN:-chat.vpsttt.com}"
export FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-$(read_env_value FRONTEND_DOMAIN)}"
export FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-chat.vpsttt.com}"
export WEBTUI_API_IMAGE="${WEBTUI_API_IMAGE:-$(read_env_value WEBTUI_API_IMAGE)}"
export WEBTUI_WORKER_IMAGE="${WEBTUI_WORKER_IMAGE:-$(read_env_value WEBTUI_WORKER_IMAGE)}"
export WEBTUI_WEB_IMAGE="${WEBTUI_WEB_IMAGE:-$(read_env_value WEBTUI_WEB_IMAGE)}"
export WEBTUI_ADMIN_IMAGE="${WEBTUI_ADMIN_IMAGE:-$(read_env_value WEBTUI_ADMIN_IMAGE)}"
export WEBTUI_PORTAL_IMAGE="${WEBTUI_PORTAL_IMAGE:-$(read_env_value WEBTUI_PORTAL_IMAGE)}"
export DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-$(read_env_value DEPLOYMENT_MODE)}"
export DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-self_hosted}"
export INSTANCE_DOMAIN="${INSTANCE_DOMAIN:-$(read_env_value INSTANCE_DOMAIN)}"
export INSTANCE_DOMAIN="${INSTANCE_DOMAIN:-$FRONTEND_DOMAIN}"
export INSTANCE_NAME="${INSTANCE_NAME:-$(read_env_value INSTANCE_NAME)}"
export INSTANCE_NAME="${INSTANCE_NAME:-WebTUI Chat}"
export PORTAL_ORIGIN="${PORTAL_ORIGIN:-$(read_env_value PORTAL_ORIGIN)}"
export PORTAL_ORIGIN="${PORTAL_ORIGIN:-https://$FRONTEND_DOMAIN}"
export PORTAL_BASE_PATH="${PORTAL_BASE_PATH:-$(read_env_value PORTAL_BASE_PATH)}"
export PORTAL_BASE_PATH="${PORTAL_BASE_PATH:-/portal}"
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-$(read_env_value NEXT_PUBLIC_API_BASE_URL)}"
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-https://chat.vpsttt.com}"
export NEXT_PUBLIC_WS_BASE_URL="${NEXT_PUBLIC_WS_BASE_URL:-$(read_env_value NEXT_PUBLIC_WS_BASE_URL)}"
export NEXT_PUBLIC_WS_BASE_URL="${NEXT_PUBLIC_WS_BASE_URL:-wss://chat.vpsttt.com/ws}"
export NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-$(read_env_value NEXT_PUBLIC_GOOGLE_CLIENT_ID)}"
export NEXT_PUBLIC_RTC_ICE_SERVERS="${NEXT_PUBLIC_RTC_ICE_SERVERS:-$(read_env_value NEXT_PUBLIC_RTC_ICE_SERVERS)}"
export NEXT_PUBLIC_RTC_ICE_SERVERS="${NEXT_PUBLIC_RTC_ICE_SERVERS:-stun:stun.l.google.com:19302}"
export CADDY_ASK_SECRET="${CADDY_ASK_SECRET:-$(read_env_value CADDY_ASK_SECRET)}"
export LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-$(read_env_value LETSENCRYPT_EMAIL)}"
export TLS_PROXY_MODE="${TLS_PROXY_MODE:-$(read_env_value TLS_PROXY_MODE)}"
export TLS_PROXY_MODE="${TLS_PROXY_MODE:-caddy}"

case "$TLS_PROXY_MODE" in
  caddy)
    PROXY_PROFILE="dynamic-tls"
    PROXY_SERVICE="caddy"
    FALLBACK_PROXY_SERVICE="nginx"
    ;;
  nginx)
    PROXY_PROFILE="static-tls"
    PROXY_SERVICE="nginx"
    FALLBACK_PROXY_SERVICE="caddy"
    ;;
  *)
    echo "TLS_PROXY_MODE must be caddy or nginx." >&2
    exit 1
    ;;
esac

require_value() {
  name="$1"
  value="$2"
  if [ "$value" = "" ]; then
    echo "Missing $name. Set it in GitHub Actions or production .env." >&2
    exit 1
  fi
}

require_value WEBTUI_API_IMAGE "$WEBTUI_API_IMAGE"
require_value WEBTUI_WORKER_IMAGE "$WEBTUI_WORKER_IMAGE"
require_value WEBTUI_WEB_IMAGE "$WEBTUI_WEB_IMAGE"
require_value WEBTUI_ADMIN_IMAGE "$WEBTUI_ADMIN_IMAGE"
require_value WEBTUI_PORTAL_IMAGE "$WEBTUI_PORTAL_IMAGE"
if [ "$DEPLOYMENT_MODE" = "self_hosted" ]; then
  require_value INSTANCE_DOMAIN "$INSTANCE_DOMAIN"
  require_value INSTANCE_NAME "$INSTANCE_NAME"
fi
if [ "$TLS_PROXY_MODE" = "caddy" ]; then
  require_value CADDY_ASK_SECRET "$CADDY_ASK_SECRET"
  require_value LETSENCRYPT_EMAIL "$LETSENCRYPT_EMAIL"
fi

mkdir -p data/desktop-releases data/mobile-releases data/download-manifests data/downloads

if [ -d deploy/download ]; then
  cp -R deploy/download/. data/downloads/
fi

write_compose_env_file() {
  {
    printf 'API_DOMAIN=%s\n' "$API_DOMAIN"
    printf 'FRONTEND_DOMAIN=%s\n' "$FRONTEND_DOMAIN"
    printf 'WEBTUI_API_IMAGE=%s\n' "$WEBTUI_API_IMAGE"
    printf 'WEBTUI_WORKER_IMAGE=%s\n' "$WEBTUI_WORKER_IMAGE"
    printf 'WEBTUI_WEB_IMAGE=%s\n' "$WEBTUI_WEB_IMAGE"
    printf 'WEBTUI_ADMIN_IMAGE=%s\n' "$WEBTUI_ADMIN_IMAGE"
    printf 'WEBTUI_PORTAL_IMAGE=%s\n' "$WEBTUI_PORTAL_IMAGE"
    printf 'DEPLOYMENT_MODE=%s\n' "$DEPLOYMENT_MODE"
    printf 'INSTANCE_DOMAIN=%s\n' "$INSTANCE_DOMAIN"
    printf 'INSTANCE_NAME=%s\n' "$INSTANCE_NAME"
    printf 'PORTAL_ORIGIN=%s\n' "$PORTAL_ORIGIN"
    printf 'PORTAL_BASE_PATH=%s\n' "$PORTAL_BASE_PATH"
    printf 'NEXT_PUBLIC_API_BASE_URL=%s\n' "$NEXT_PUBLIC_API_BASE_URL"
    printf 'NEXT_PUBLIC_WS_BASE_URL=%s\n' "$NEXT_PUBLIC_WS_BASE_URL"
    printf 'NEXT_PUBLIC_GOOGLE_CLIENT_ID=%s\n' "$NEXT_PUBLIC_GOOGLE_CLIENT_ID"
    printf 'NEXT_PUBLIC_RTC_ICE_SERVERS=%s\n' "$NEXT_PUBLIC_RTC_ICE_SERVERS"
    printf 'CADDY_ASK_SECRET=%s\n' "$CADDY_ASK_SECRET"
    printf 'LETSENCRYPT_EMAIL=%s\n' "$LETSENCRYPT_EMAIL"
  } > "$COMPOSE_ENV_FILE"
}

write_compose_env_file

compose() {
  docker compose --profile "$PROXY_PROFILE" --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose_all_proxies() {
  docker compose \
    --profile dynamic-tls \
    --profile static-tls \
    --env-file "$COMPOSE_ENV_FILE" \
    -f "$COMPOSE_FILE" \
    "$@"
}

wait_for_public_health() {
  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi

  attempt=1
  while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
    if curl -fsS "$API_HEALTH_URL" >/dev/null; then
      echo "Health check passed: $API_HEALTH_URL"
      return 0
    fi

    echo "Health check not ready yet ($attempt/$HEALTH_RETRIES): $API_HEALTH_URL"
    attempt=$((attempt + 1))
    sleep "$HEALTH_SLEEP_SECONDS"
  done

  echo "Health check failed after $HEALTH_RETRIES attempts: $API_HEALTH_URL" >&2
  return 1
}

AUTO_INIT_TLS="${AUTO_INIT_TLS:-$(read_env_value AUTO_INIT_TLS)}"
SKIP_PULL="${SKIP_PULL:-false}"

if [ "$TLS_PROXY_MODE" = "nginx" ] && [ "$AUTO_INIT_TLS" = "true" ]; then
  COMPOSE_ENV_FILE="$COMPOSE_ENV_FILE" sh deploy/scripts/init-letsencrypt.sh
fi

if [ "$SKIP_PULL" != "true" ]; then
  compose pull
fi
compose --profile migration run --rm migrate
compose up -d postgres redis api worker web admin portal
compose_all_proxies stop "$FALLBACK_PROXY_SERVICE"
if ! compose up -d --force-recreate "$PROXY_SERVICE"; then
  echo "Failed to start $PROXY_SERVICE. Restoring $FALLBACK_PROXY_SERVICE." >&2
  compose_all_proxies stop "$PROXY_SERVICE" || true
  compose_all_proxies up -d "$FALLBACK_PROXY_SERVICE"
  exit 1
fi
compose ps
if ! wait_for_public_health; then
  echo "Public health failed with $PROXY_SERVICE. Restoring $FALLBACK_PROXY_SERVICE." >&2
  compose_all_proxies stop "$PROXY_SERVICE" || true
  compose_all_proxies up -d "$FALLBACK_PROXY_SERVICE"
  exit 1
fi
