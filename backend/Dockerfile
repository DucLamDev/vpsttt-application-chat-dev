FROM golang:1.25-alpine AS build

WORKDIR /src

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/webtui-api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/webtui-worker ./cmd/worker
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/webtui-migrate ./cmd/migrate

FROM alpine:3.22 AS runtime

RUN apk add --no-cache ca-certificates postgresql-client tzdata wget \
  && addgroup -S webtui \
  && adduser -S -G webtui webtui

WORKDIR /app

COPY --from=build /out/webtui-api /usr/local/bin/webtui-api
COPY --from=build /out/webtui-worker /usr/local/bin/webtui-worker
COPY --from=build /out/webtui-migrate /usr/local/bin/webtui-migrate
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY db/migrations ./db/migrations

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R webtui:webtui /app

ENV APP_ENV=production
ENV DATABASE_MIGRATIONS_PATH=/app/db/migrations

USER webtui

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["api"]

FROM runtime AS api
CMD ["api"]

FROM runtime AS worker
CMD ["worker"]
