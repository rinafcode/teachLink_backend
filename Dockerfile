# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Install production dependencies
RUN npm ci --only=production

# Use non-root user for security
USER node

# Expose application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]