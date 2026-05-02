# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init \
  && rm -rf /var/cache/apk/*

WORKDIR /app

# Install production dependencies as root before switching user
COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create writable tmp dir for the app, then lock down ownership
RUN mkdir -p /app/tmp && chown -R node:node /app

# Drop to non-root user
USER node

EXPOSE 3000

# no-new-privileges enforced at runtime via security_opt in compose;
# dumb-init ensures SIGTERM is forwarded to the Node process
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]