# syntax=docker/dockerfile:1.7
# Multi-stage Docker build for Survai on Cloud Run.
#
# Stage 1 (deps):      install all npm deps for the build.
# Stage 2 (builder):   compile the Next.js standalone production build.
# Stage 3 (runner):    minimal runtime image, non-root user, port 8080.
#
# NEXT_PUBLIC_* env vars are baked into the client bundle during `next build`,
# NOT injected at runtime. Pass them via --build-arg during `docker build`
# (Cloud Run does this for you via `--build-env-vars` when deploying with
# `--source`). Runtime-only secrets (service role, API keys) are mounted
# as env vars by Cloud Run from Secret Manager.

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time NEXT_PUBLIC_* baked into the client bundle.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run expects the container to listen on $PORT (default 8080).
ENV PORT=8080
# Bind to all interfaces so Cloud Run's proxy can reach the server.
ENV HOSTNAME=0.0.0.0

# Non-root runtime user.
RUN addgroup -S app && adduser -S app -G app

# Standalone build output + static assets + public/.
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app
EXPOSE 8080
CMD ["node", "server.js"]
