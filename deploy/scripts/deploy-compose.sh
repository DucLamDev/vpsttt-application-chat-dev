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
export FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-$(read_env_value FRONTEND_DOMAIN)}"
export WEBTUI_API_IMAGE="${WEBTUI_API_IMAGE:-$(read_env_value WEBTUI_API_IMAGE)}"
export WEBTUI_WORKER_IMAGE="${WEBTUI_WORKER_IMAGE:-$(read_env_value WEBTUI_WORKER_IMAGE)}"

write_compose_env_file() {
  {
    printf 'API_DOMAIN=%s\n' "$API_DOMAIN"
    printf 'FRONTEND_DOMAIN=%s\n' "$FRONTEND_DOMAIN"
    printf 'WEBTUI_API_IMAGE=%s\n' "$WEBTUI_API_IMAGE"
    printf 'WEBTUI_WORKER_IMAGE=%s\n' "$WEBTUI_WORKER_IMAGE"
  } > "$COMPOSE_ENV_FILE"
}

write_compose_env_file

compose() {
  docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
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

if [ "$AUTO_INIT_TLS" = "true" ]; then
  COMPOSE_ENV_FILE="$COMPOSE_ENV_FILE" sh deploy/scripts/init-letsencrypt.sh
fi

compose pull
compose --profile migration run --rm migrate
compose up -d --remove-orphans
compose ps
wait_for_public_health