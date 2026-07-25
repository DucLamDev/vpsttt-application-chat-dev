FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/portal/package.json apps/portal/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/chat-core/package.json packages/chat-core/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/icons/package.json packages/icons/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

FROM deps AS build

ARG NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL=https://download.webtuichat.com/desktop
ARG NEXT_PUBLIC_MOBILE_DOWNLOAD_URL=https://download.webtuichat.com/mobile
ARG NEXT_PUBLIC_DOCUMENTATION_URL=https://docs.webtuichat.com
ARG NEXT_PUBLIC_PORTAL_BASE_PATH=
ENV NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL=$NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL
ENV NEXT_PUBLIC_MOBILE_DOWNLOAD_URL=$NEXT_PUBLIC_MOBILE_DOWNLOAD_URL
ENV NEXT_PUBLIC_DOCUMENTATION_URL=$NEXT_PUBLIC_DOCUMENTATION_URL
ENV NEXT_PUBLIC_PORTAL_BASE_PATH=$NEXT_PUBLIC_PORTAL_BASE_PATH

COPY . .
RUN npm run build:portal

FROM node:24-alpine AS runner

WORKDIR /app
ARG NEXT_PUBLIC_PORTAL_BASE_PATH=
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV NEXT_PUBLIC_PORTAL_BASE_PATH=$NEXT_PUBLIC_PORTAL_BASE_PATH

COPY --from=build /app ./

EXPOSE 3002

CMD ["npm", "--workspace", "@webtui/portal", "run", "start"]
