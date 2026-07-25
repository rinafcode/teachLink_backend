# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS production

ENV NODE_ENV=production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init \
  && rm -rf /var/cache/apk/*

WORKDIR /app

RUN apk add --no-cache dumb-init curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/tmp && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# dumb-init ensures SIGTERM is forwarded to the Node process
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
