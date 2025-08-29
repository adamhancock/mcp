# Multi-stage build for MCP packages
FROM node:22-alpine AS builder

# Accept the package name as a build argument
ARG PACKAGE_NAME
RUN test -n "$PACKAGE_NAME" || (echo "PACKAGE_NAME build arg is required" && exit 1)

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy only the specific package we're building
COPY packages/${PACKAGE_NAME}/package.json ./packages/${PACKAGE_NAME}/
COPY packages/${PACKAGE_NAME}/tsconfig.json* ./packages/${PACKAGE_NAME}/
COPY packages/${PACKAGE_NAME}/src ./packages/${PACKAGE_NAME}/src

# Install dependencies for the workspace (needed for workspace dependencies)
RUN pnpm install --frozen-lockfile --filter "./packages/${PACKAGE_NAME}"

# Build only the specific package
RUN pnpm --filter "./packages/${PACKAGE_NAME}" build

# Runtime stage
FROM node:22-alpine

# Accept the package name as a build argument
ARG PACKAGE_NAME
RUN test -n "$PACKAGE_NAME" || (echo "PACKAGE_NAME build arg is required" && exit 1)

# Install pnpm (needed for running with workspace dependencies)
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy workspace configuration files (needed for pnpm workspace)
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy only the specific built package
COPY --from=builder /app/packages/${PACKAGE_NAME} ./packages/${PACKAGE_NAME}

# Copy node_modules for the specific package and workspace root
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/${PACKAGE_NAME}/node_modules ./packages/${PACKAGE_NAME}/node_modules

# Switch to non-root user
USER nodejs

# Set the package name as environment variable
ENV PACKAGE_NAME=${PACKAGE_NAME}

# Default entrypoint - runs the specific package
ENTRYPOINT ["sh", "-c", "cd packages/${PACKAGE_NAME} && node dist/index.js"]