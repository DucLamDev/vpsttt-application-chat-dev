FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/icons/package.json packages/icons/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

FROM deps AS build

COPY . .
RUN npm run build:admin

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

COPY --from=build /app ./

EXPOSE 3001

CMD ["npm", "--workspace", "@webtui/admin", "run", "start"]
