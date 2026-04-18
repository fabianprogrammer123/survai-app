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

# Build-time NEXT_PUBLIC_* baked into the client bundle. These are PUBLIC
# values by design — the Supabase anon key is already exposed to every
# browser loading the app, and RLS policies enforce data isolation. Defaults
# reference the existing Survai Supabase project. Override via --build-arg
# when deploying a different environment (staging, etc.).
#
# Note: `gcloud run deploy --source --set-build-env-vars` does NOT translate
# to Dockerfile --build-arg (it's buildpack-only). That's why defaults live
# here. For secret values, use Secret Manager mounted at runtime, not here.
ARG NEXT_PUBLIC_SUPABASE_URL=https://shgsuahugiiuyopwyxtp.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoZ3N1YWh1Z2lpdXlvcHd5eHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njc0MTgsImV4cCI6MjA5MjA0MzQxOH0.fYpuzVnhhIy3sICHVLaEcXgT3MtAV1r4O-QqaTMHEvY
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
