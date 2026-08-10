# =============================================================================
# IoM UI Dockerfile - Standalone Mode (node server.js)
# =============================================================================
# Optimized build using Next.js standalone output
# Smaller image, faster startup, no npm at runtime
#
# REQUIRES: Add `output: 'standalone'` to next.config.mjs
#
# Build: docker build -f Dockerfile.standalone -t iom-ui .
# Run:   docker run -p 3000:3000 --env-file .env iom-ui

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
# TIP: For reproducible builds, pin to a specific digest:
#   FROM node:25-alpine@sha256:<digest> AS deps
# Get the current digest: docker pull node:25-alpine && docker inspect --format='{{.RepoDigests}}' node:25-alpine
FROM node:25-alpine AS deps
WORKDIR /app

# Install pnpm globally.
RUN npm install -g pnpm@11.5.0

# Husky's `prepare` script is irrelevant in CI/Docker (no .git, no commits here).
# HUSKY=0 is the documented way to skip it cleanly.
ENV HUSKY=0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:25-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# This layer is always cold, so Turbopack's build cache (a default since 16.3)
# would be written and never read. See next.config.mjs.
ENV DOCKER_BUILD=true

# Build application (no NEXT_PUBLIC_* needed - config served at runtime)
RUN npm install -g pnpm@11.5.0
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Runner (Production)
# -----------------------------------------------------------------------------
FROM node:25-alpine AS runner
WORKDIR /app

# Production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Remove source maps from production image (uploaded separately to Sentry)
RUN find .next -name '*.map' -delete 2>/dev/null || true

# Create writable directories for runtime.
# No app code writes to ./logs (logger sinks are stdout + Sentry only).
RUN mkdir -p ./.next/cache/images ./.next/cache/fetch-cache && \
    chown -R nextjs:nodejs ./.next && \
    chmod -R u+rwX ./.next/cache

# Switch to non-root user
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
