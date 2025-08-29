# Multi-stage build for MCP packages
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy all packages
COPY packages/ ./packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm -r build

# Runtime stage
FROM node:22-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy workspace files
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy built packages
COPY --from=builder /app/packages ./packages

# Copy node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/*/node_modules ./packages/*/node_modules

# Switch to non-root user
USER nodejs

# The specific package to run will be specified via build args and entrypoint
ARG PACKAGE_NAME
ENV PACKAGE_NAME=${PACKAGE_NAME}

# Default entrypoint - can be overridden
ENTRYPOINT ["sh", "-c", "cd packages/${PACKAGE_NAME} && node dist/index.js"]