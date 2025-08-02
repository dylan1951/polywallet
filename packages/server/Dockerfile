FROM oven/bun:canary AS base

WORKDIR /app

COPY package.json .
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --filter '@packages/server'

COPY packages/server ./packages/server
COPY packages/shared ./packages/shared

ENV NODE_ENV=production
CMD ["bun", "packages/server/src/index.ts"]

EXPOSE 3000
