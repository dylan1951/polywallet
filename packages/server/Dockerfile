FROM oven/bun:canary AS base

WORKDIR /app

COPY package.json .
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

RUN bun install

COPY packages/server ./packages/server
COPY packages/shared ./packages/shared

ENV NODE_ENV=production
CMD ["bun", "run", "packages/server/src/index.ts"]

EXPOSE 3000
