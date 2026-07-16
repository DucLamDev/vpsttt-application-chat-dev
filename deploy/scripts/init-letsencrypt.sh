#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker/compose.prod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.compose.env}"
export COMPOSE_DISABLE_ENV_FILE=1

read_env_value() {
  key="$1"
  if [ -f ".env" ]; then
    sed -n "s/^$key=//p" .env | tail -n 1
  fi
}

export API_DOMAIN="${API_DOMAIN:-$(read_env_value API_DOMAIN)}"
export API_DOMAIN="${API_DOMAIN:-chat.vpsttt.com}"
export FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-$(read_env_value FRONTEND_DOMAIN)}"
export FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-chat.vpsttt.com}"
export LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-$(read_env_value LETSENCRYPT_EMAIL)}"
export WEBTUI_API_IMAGE="${WEBTUI_API_IMAGE:-$(read_env_value WEBTUI_API_IMAGE)}"
export WEBTUI_WORKER_IMAGE="${WEBTUI_WORKER_IMAGE:-$(read_env_value WEBTUI_WORKER_IMAGE)}"
export WEBTUI_WEB_IMAGE="${WEBTUI_WEB_IMAGE:-$(read_env_value WEBTUI_WEB_IMAGE)}"

require_value() {
  name="$1"
  value="$2"
  if [ "$value" = "" ]; then
    echo "Missing $name. Set it in GitHub Actions or production .env." >&2
    exit 1
  fi
}

require_value LETSENCRYPT_EMAIL "$LETSENCRYPT_EMAIL"
require_value WEBTUI_API_IMAGE "$WEBTUI_API_IMAGE"
require_value WEBTUI_WORKER_IMAGE "$WEBTUI_WORKER_IMAGE"
require_value WEBTUI_WEB_IMAGE "$WEBTUI_WEB_IMAGE"

write_compose_env_file() {
  {
    printf 'API_DOMAIN=%s\n' "$API_DOMAIN"
    printf 'FRONTEND_DOMAIN=%s\n' "$FRONTEND_DOMAIN"
    printf 'WEBTUI_API_IMAGE=%s\n' "$WEBTUI_API_IMAGE"
    printf 'WEBTUI_WORKER_IMAGE=%s\n' "$WEBTUI_WORKER_IMAGE"
    printf 'WEBTUI_WEB_IMAGE=%s\n' "$WEBTUI_WEB_IMAGE"
  } > "$COMPOSE_ENV_FILE"
}

write_compose_env_file

compose() {
  docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

create_temporary_certificate() {
  echo "Creating temporary certificate for $API_DOMAIN."
  compose run --rm --no-deps --entrypoint sh nginx -c "\
    apk add --no-cache openssl >/dev/null && \
    mkdir -p /etc/letsencrypt/live/$API_DOMAIN && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/$API_DOMAIN/privkey.pem \
      -out /etc/letsencrypt/live/$API_DOMAIN/fullchain.pem \
      -subj '/CN=$API_DOMAIN'"
}

if [ "${API_DOMAIN:-}" = "" ]; then
  echo "Missing API_DOMAIN." >&2
  exit 1
fi

domain_args="-d $API_DOMAIN"
if [ "${FRONTEND_DOMAIN:-}" != "" ] && [ "$FRONTEND_DOMAIN" != "$API_DOMAIN" ]; then
  domain_args="$domain_args -d $FRONTEND_DOMAIN"
fi

request_certificate() {
  extra_args="$1"
  compose run --rm certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    $extra_args \
    $domain_args
}

if compose run --rm --no-deps --entrypoint sh nginx -c "test -f /etc/letsencrypt/live/$API_DOMAIN/fullchain.pem"; then
  echo "TLS certificate already exists for $API_DOMAIN."
  compose up -d nginx

  if [ "${FRONTEND_DOMAIN:-}" != "" ] && [ "$FRONTEND_DOMAIN" != "$API_DOMAIN" ]; then
    echo "Ensuring TLS certificate also covers $FRONTEND_DOMAIN."
    if ! request_certificate "--expand --keep-until-expiring"; then
      echo "Let's Encrypt update failed for $FRONTEND_DOMAIN." >&2
      exit 1
    fi
    compose exec -T nginx nginx -s reload
  fi

  exit 0
fi

create_temporary_certificate
compose up -d --force-recreate nginx

echo "Removing temporary certificate before requesting Let's Encrypt."
compose run --rm --no-deps --entrypoint sh nginx -c "\
  rm -rf /etc/letsencrypt/live/$API_DOMAIN \
         /etc/letsencrypt/archive/$API_DOMAIN \
         /etc/letsencrypt/renewal/$API_DOMAIN.conf"

echo "Requesting Let's Encrypt certificate."
if ! request_certificate ""; then
  echo "Let's Encrypt request failed. Restoring temporary certificate so Nginx can keep serving." >&2
  create_temporary_certificate
  compose up -d --force-recreate nginx
  exit 1
fi

compose exec -T nginx nginx -s reload

echo "TLS initialization completed."
