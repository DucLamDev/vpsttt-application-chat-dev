#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker/compose.prod.yml}"

read_env_value() {
  key="$1"
  if [ -f ".env" ]; then
    sed -n "s/^$key=//p" .env | tail -n 1
  fi
}

API_DOMAIN="${API_DOMAIN:-$(read_env_value API_DOMAIN)}"
FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-$(read_env_value FRONTEND_DOMAIN)}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-$(read_env_value LETSENCRYPT_EMAIL)}"

if [ "${API_DOMAIN:-}" = "" ]; then
  echo "Thiếu API_DOMAIN." >&2
  exit 1
fi

if [ "${LETSENCRYPT_EMAIL:-}" = "" ]; then
  echo "Thiếu LETSENCRYPT_EMAIL." >&2
  exit 1
fi

if docker compose -f "$COMPOSE_FILE" run --rm --no-deps --entrypoint sh nginx -c "test -f /etc/letsencrypt/live/$API_DOMAIN/fullchain.pem"; then
  echo "Chứng chỉ TLS đã tồn tại cho $API_DOMAIN."
  exit 0
fi

domain_args="-d $API_DOMAIN"
if [ "${FRONTEND_DOMAIN:-}" != "" ]; then
  domain_args="$domain_args -d $FRONTEND_DOMAIN"
fi

echo "Tạo chứng chỉ tạm để Nginx khởi động."
docker compose -f "$COMPOSE_FILE" run --rm --no-deps --entrypoint sh nginx -c "\
  apk add --no-cache openssl >/dev/null && \
  mkdir -p /etc/letsencrypt/live/$API_DOMAIN && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$API_DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$API_DOMAIN/fullchain.pem \
    -subj '/CN=$API_DOMAIN'"

docker compose -f "$COMPOSE_FILE" up -d nginx

echo "Xóa chứng chỉ tạm trước khi xin chứng chỉ Let's Encrypt."
docker compose -f "$COMPOSE_FILE" run --rm --no-deps --entrypoint sh nginx -c "\
  rm -rf /etc/letsencrypt/live/$API_DOMAIN \
         /etc/letsencrypt/archive/$API_DOMAIN \
         /etc/letsencrypt/renewal/$API_DOMAIN.conf"

echo "Xin chứng chỉ Let's Encrypt."
docker compose -f "$COMPOSE_FILE" run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  $domain_args

docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

echo "Khởi tạo TLS hoàn tất."
