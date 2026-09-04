# =============================================================================
# IoM UI Dockerfile - Standalone Mode (node server.js)
# =============================================================================
# Optimized build using Next.js standalone output
# Smaller image, faster startup, no npm at runtime
#
# REQUIRES: Add `output: 'standalone'` to next.config.mjs
#
# Build: docker build -t iom-ui .
# Run:   docker run -p 3000:3000 --env-file .env iom-ui

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
# 24 is the current LTS line, and what ci.yml gates on. Do not move to an
# odd-numbered line: those never reach LTS.
# TIP: For reproducible builds, pin to a specific digest:
#   FROM node:24-alpine@sha256:<digest> AS deps
# Get the current digest: docker pull node:24-alpine && docker inspect --format='{{.RepoDigests}}' node:24-alpine
FROM node:24-alpine AS deps
WORKDIR /app

# pnpm comes from package.json "packageManager" via corepack, so this cannot
# drift from what the repo declares. A hardcoded `npm i -g pnpm@x` silently
# does, and pnpm then self-switches on every build.
RUN corepack enable pnpm

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
FROM node:24-alpine AS builder
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
RUN corepack enable pnpm
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Runner (Production)
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runner
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

# 127.0.0.1, not localhost: wget tries the IPv6 [::1] first, and the server
# binds HOSTNAME=0.0.0.0 (IPv4 only), so `localhost` is refused and the
# container reports unhealthy forever while serving normally.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
