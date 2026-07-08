#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker/compose.prod.yml}"
API_HEALTH_URL="${API_HEALTH_URL:-http://localhost/ready}"

if [ ! -f ".env" ]; then
  echo "Thiếu file .env production tại thư mục deploy." >&2
  exit 1
fi

read_env_value() {
  key="$1"
  sed -n "s/^$key=//p" .env | tail -n 1
}

AUTO_INIT_TLS="${AUTO_INIT_TLS:-$(read_env_value AUTO_INIT_TLS)}"

if [ "$AUTO_INIT_TLS" = "true" ]; then
  sh deploy/scripts/init-letsencrypt.sh
fi

docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" --profile migration run --rm migrate
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

if command -v curl >/dev/null 2>&1; then
  curl -fsS "$API_HEALTH_URL" >/dev/null
fi
