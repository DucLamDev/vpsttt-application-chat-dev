#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker/compose.prod.yml}"

docker compose -f "$COMPOSE_FILE" run --rm certbot renew --webroot --webroot-path /var/www/certbot
docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

echo "Gia hạn TLS hoàn tất."
