# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS production

ENV NODE_ENV=production

# Install dumb-init for proper signal handling and curl for health checks
RUN apk add --no-cache dumb-init curl \
  && rm -rf /var/cache/apk/*

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/tmp && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# dumb-init ensures SIGTERM is forwarded to the Node process
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
