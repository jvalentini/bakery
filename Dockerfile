FROM oven/bun:1.3-alpine AS base

WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["bun", "run", "dev"]

FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["bun", "test"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS binary-builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG TARGET=linux-x64
RUN bun build src/cli.ts --compile --target=bun-${TARGET} --outfile /app/dist/cli-template-${TARGET}

FROM base AS production
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
ENTRYPOINT ["bun", "run", "dist/cli.js"]
