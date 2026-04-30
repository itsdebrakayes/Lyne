# ─────────────────────────────────────────────────────────────
#  Q ME NOW Backend API — Dockerfile
#  Multi-stage build: deps → production image
# ─────────────────────────────────────────────────────────────

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Stage 2: Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 qmenow

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the app runs as non-root
USER qmenow

EXPOSE 4000

ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "src/index.js"]
