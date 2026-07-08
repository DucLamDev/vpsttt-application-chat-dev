#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker/compose.prod.yml}"
export COMPOSE_DISABLE_ENV_FILE=1
API_HEALTH_URL="${API_HEALTH_URL:-http://localhost/ready}"

if [ ! -f ".env" ]; then
  echo "Missing production .env in deploy directory." >&2
  exit 1
fi

read_env_value() {
  key="$1"
  sed -n "s/^$key=//p" .env | tail -n 1
}

export API_DOMAIN="${API_DOMAIN:-$(read_env_value API_DOMAIN)}"
export FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-$(read_env_value FRONTEND_DOMAIN)}"
export WEBTUI_API_IMAGE="${WEBTUI_API_IMAGE:-$(read_env_value WEBTUI_API_IMAGE)}"
export WEBTUI_WORKER_IMAGE="${WEBTUI_WORKER_IMAGE:-$(read_env_value WEBTUI_WORKER_IMAGE)}"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

AUTO_INIT_TLS="${AUTO_INIT_TLS:-$(read_env_value AUTO_INIT_TLS)}"

if [ "$AUTO_INIT_TLS" = "true" ]; then
  sh deploy/scripts/init-letsencrypt.sh
fi

compose pull
compose --profile migration run --rm migrate
compose up -d --remove-orphans
compose ps

if command -v curl >/dev/null 2>&1; then
  curl -fsS "$API_HEALTH_URL" >/dev/null
fi
