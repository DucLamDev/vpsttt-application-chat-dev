FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/chat-core/package.json packages/chat-core/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/icons/package.json packages/icons/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

FROM deps AS build

ARG NEXT_PUBLIC_API_BASE_URL=https://api.vpsttt.com
ARG NEXT_PUBLIC_WS_BASE_URL=wss://api.vpsttt.com/api/v1/ws
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WS_BASE_URL=$NEXT_PUBLIC_WS_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

COPY . .
RUN npm run build:web

FROM node:24-alpine AS runner

WORKDIR /app
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_BASE_URL=https://api.vpsttt.com
ENV NEXT_PUBLIC_WS_BASE_URL=wss://api.vpsttt.com/api/v1/ws
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV PORT=3000

COPY --from=build /app ./

EXPOSE 3000

CMD ["npm", "--workspace", "@webtui/web", "run", "start"]
