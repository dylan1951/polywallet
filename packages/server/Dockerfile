FROM oven/bun:alpine AS base

WORKDIR /app

COPY package.json .
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

ENV HUSKY=0
RUN bun install

COPY packages/server ./packages/server
COPY packages/shared ./packages/shared

ENV NODE_ENV=production
WORKDIR /app/packages/server
ENTRYPOINT ["bun", "start"]

EXPOSE 3001
