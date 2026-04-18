# GCP Deployment Plan — Backend Path to Production

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Survai from "works on Fabian's laptop at localhost:3004" to "lives at survai.app on Google Cloud Run, real users sign up and share survey links that work from anywhere." Stand-alone product. Single-region. MVP-grade hardening (no over-engineering for scale that doesn't exist yet).

**Why this matters now:** Voice + phone surveys (M3) require **public HTTPS webhook endpoints** for ElevenLabs and Twilio. Until the app is reachable on a real domain, M3 can't be tested end-to-end. GCP deploy is the gate to the headline feature.

**Architecture (one-line summary):** Cloud Run serves a containerized Next.js standalone build, talking to the existing hosted Supabase project over HTTPS, with secrets in Google Secret Manager and structured logs auto-ingested by Cloud Logging. Custom domain via Cloud Run domain mapping. No load balancer, no Cloud SQL, no GKE — just Cloud Run + Supabase + DNS.

**Tech stack additions:** Docker, gcloud CLI, Google Cloud Run, Google Secret Manager, Google Cloud Build (for image builds), Google Cloud Logging (auto), Google Cloud DNS or external registrar.

---

## Decision tree — why these choices, not others

### Hosting target → **Cloud Run**

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Cloud Run** ✅ | Scale to zero ($0 idle), HTTPS + custom domain free, one-command deploy, container-native, ~1-2s cold starts acceptable for MVP | Cold starts on bursty traffic, 60-min request timeout (irrelevant for us) | **Pick this.** Built for exactly our shape. |
| App Engine Standard | Mature, similar pricing | Locked into older Node runtimes, less Docker-native | No |
| App Engine Flexible | Container-based | Always-on (no scale-to-zero), more expensive | No |
| GKE | Full Kubernetes power | Massive operational overhead for a single Next.js app | No (premature) |
| Compute Engine VM | Full control | Manual nginx, systemd, certbot, OS patching, autoscaling | No (we're a 1-person team) |
| Vercel | Best Next.js DX, great preview deploys | Outside our GCP-only constraint, less control over webhook latency | No (you said GCP) |

### Database → **stay on existing hosted Supabase**

The `shgsuahugiiuyopwyxtp` project at `supabase.co` is already a Postgres 17 instance with our schema applied. **There is no database migration needed.** The Cloud Run app talks to it over the same HTTPS connection that localhost does today. This eliminates a whole class of work (no Cloud SQL provisioning, no connection pooling config, no VPC peering, no backup setup).

If we ever outgrow Supabase, we move to Cloud SQL Postgres + Supabase-self-hosted on GKE — but that's a 100K-MAU problem, not an MVP problem.

### Secrets → **Google Secret Manager** (not env vars in Cloud Run config)

| Option | Pros | Cons |
|---|---|---|
| **Secret Manager** ✅ | Audit trail, IAM-controlled, rotation-friendly, mounted as env vars at runtime | One extra setup step |
| Cloud Run env vars | Simplest | Stored in Cloud Run config (visible to anyone with `roles/run.viewer`), no rotation story |
| `.env` baked in image | Catastrophic | Secrets in container layers forever, leaked on any image pull |

### Domain → **buy real domain + Cloud Run domain mapping**

`*.run.app` works for testing but hard to remember and untrustworthy-looking on a real survey link. Buy `survai.app` (or whatever's available) — ~$12/year. Cloud Run handles cert provisioning automatically once DNS points to it.

### CI/CD → **manual `gcloud run deploy --source .` for MVP, GitHub Actions later**

For 1-2 demo users you don't need preview environments. The first 10 deploys can be `gcloud` from your laptop. When you're ready, a 30-line `.github/workflows/deploy.yml` adds auto-deploy on `main` push.

### Logging → **stdout JSON → Cloud Logging (already wired)**

We already write structured JSON logs to stdout via `src/lib/log.ts`. Cloud Run pipes stdout to Cloud Logging automatically with zero config. No SDK to install. Filtering and alerts go through Cloud Logging's UI.

### Monitoring → **Cloud Monitoring uptime check + log-based alert** (skip Sentry for now)

Cloud Run + Cloud Logging gives you 90% of what Sentry provides for free. One uptime check on the homepage + one log-based alert when `level=error` occurs at >N/min covers MVP needs. Sentry can be added later if you want stack-trace-deduped issue tracking.

### Build → **Cloud Build via `--source` flag**

`gcloud run deploy --source .` automatically uses Cloud Build to containerize and push to Artifact Registry. No local Docker daemon required. Builds run in GCP. Caches help repeat deploys.

---

## Phase A: Backend code changes (BEFORE first deploy)

These are the in-repo edits that make the app GCP-ready. **All scoped to backend/infra files — no frontend agent territory touched.**

### File Structure

| Path | Change | Why |
|---|---|---|
| `next.config.ts` | Add `output: 'standalone'`, HSTS header, basic CSP | Standalone build is ~5x smaller (200MB vs 1GB Docker image). HSTS forces HTTPS in browsers. |
| `Dockerfile` (new) | Multi-stage Node 22-alpine build → standalone runtime | Container artifact for Cloud Run |
| `.dockerignore` (new) | Exclude `.git`, `node_modules`, `.next`, `.worktrees`, `tests/` | Keep image lean and avoid leaking dev artifacts |
| `src/app/api/health/route.ts` (new) | Lightweight `{ ok: true, ts }` endpoint | Cloud Run readiness probe + uptime monitor target. The existing `/api/ai/health` checks OpenAI; we want a no-deps liveness check. |
| `src/lib/env.ts` (new) | Boot-time env validation — fail-fast if required vars missing | Catches misconfigured Cloud Run revisions immediately, not 50 requests later |
| `src/proxy.ts` | Add a few production-aware tweaks (forward `X-Forwarded-*` if needed) | Cloud Run sets these correctly by default but worth verifying in code |
| `src/lib/supabase/server.ts` + `client.ts` | Remove the `localhost:54321` fallback in production builds — fail loud instead | The fallback masks misconfig in prod. Acceptable in dev. |
| `package.json` | Add `"start": "node .next/standalone/server.js"` script if not present | Cloud Run boots via this command |
| `.env.production.example` (new) | Template listing every env var the production app needs | Documentation + reference for Secret Manager setup |
| `cloudbuild.yaml` (new) | Optional: explicit build steps if `--source` defaults aren't right | Only needed if we want custom build args |

### Tasks

#### Task A1: `next.config.ts` — standalone build + HSTS + CSP

- [ ] **Step A1.1: Add `output: 'standalone'`**

In `next.config.ts`, add `output: 'standalone'` to the config object. This tells Next.js to emit a self-contained `.next/standalone/` directory containing only the files the production server needs (no node_modules tree, no source maps).

- [ ] **Step A1.2: Add HSTS + relaxed CSP**

Extend the existing `headers()` block. In the `/(.*)` rule, add:

```ts
{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
// CSP is intentionally loose for MVP — Next.js inline scripts make strict CSP hard.
// Locks down the dangerous stuff (frame-ancestors) without breaking React's hydration.
{ key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
```

`frame-ancestors 'none'` is the modern replacement for `X-Frame-Options: DENY` (which we already have — both in the response is fine, browsers honor whichever is stricter).

- [ ] **Step A1.3: Verify locally**

```bash
npm run build
# Expect: "Creating an optimized production build" → "Generating static pages" → output ends with bundle stats
ls .next/standalone/server.js
# Expect: file exists
```

If the standalone build fails, check Next.js docs for any required peer config (e.g. `experimental.serverComponentsExternalPackages` for some libs).

- [ ] **Step A1.4: Commit**

```bash
git add next.config.ts
git commit -m "chore(infra): standalone build output + HSTS + frame-ancestors CSP"
```

---

#### Task A2: Dockerfile + .dockerignore

- [ ] **Step A2.1: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
# ---- deps stage: install all deps for build ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder stage: produce the standalone build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* must be present at build time (baked into client bundle).
# These come in as --build-arg from Cloud Build.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime stage: minimal image, runs as non-root ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 8080
CMD ["node", "server.js"]
```

Key choices explained:
- **node:22-alpine** for size (~50MB base) and Node 22 LTS
- **Multi-stage build** so deps and source aren't in the runtime image
- **NEXT_PUBLIC_* baked at build time** — this is the most common Next.js production gotcha. NEXT_PUBLIC_ vars are inlined into the client bundle during `next build`. Setting them only at runtime won't work for client-side Supabase calls. Cloud Build passes them via `--build-arg`.
- **PORT=8080** because that's Cloud Run's default expected port (configurable but 8080 is convention)
- **HOSTNAME=0.0.0.0** so the server binds publicly inside the container (not just localhost which only Docker sees)
- **Non-root user** for security best practice

- [ ] **Step A2.2: Create `.dockerignore`**

```
.git
.gitignore
.github
.next
.env*
.worktrees
.audit
node_modules
npm-debug.log
README.md
HANDOVER.md
EXTENDING.md
docs
tests
.vscode
.idea
*.md
!supabase/migrations/README.md
```

- [ ] **Step A2.3: Local Docker build smoke (optional but recommended)**

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://shgsuahugiiuyopwyxtp.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
  -t survai-local .
docker run --rm -p 8080:8080 \
  -e SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  -e OPENAI_API_KEY=<openai-key> \
  -e ELEVENLABS_API_KEY=<elevenlabs-key> \
  survai-local
# In another terminal: curl http://localhost:8080/ should return 200
```

If you don't have Docker locally, skip — Cloud Build will run it anyway.

- [ ] **Step A2.4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(infra): Dockerfile (standalone, multi-stage, non-root) + .dockerignore"
```

---

#### Task A3: Health endpoint + env validation

- [ ] **Step A3.1: Create `src/app/api/health/route.ts`**

```ts
import { NextResponse } from 'next/server';

/**
 * Minimal liveness probe. No dependencies — just confirms the process
 * is up and responding. Used by Cloud Run's startup probe and any
 * external uptime monitor. For a deeper check (Supabase reachable?
 * OpenAI key valid?) see /api/ai/health.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    version: process.env.K_REVISION ?? 'local', // K_REVISION is set by Cloud Run
  });
}
```

- [ ] **Step A3.2: Create `src/lib/env.ts` — boot-time validation**

```ts
/**
 * Validates required environment variables at module load time.
 * Imported once from a server-only entrypoint (e.g. proxy.ts) so a
 * misconfigured deployment fails on first cold start, not on the
 * Nth user request when the missing var is finally read.
 */
const REQUIRED_SERVER_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
] as const;

const OPTIONAL_SERVER_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY', // optional in M0; required for guest invites + admin scripts
  'ELEVENLABS_API_KEY',         // optional until voice mode (M3) is enabled
] as const;

export function assertServerEnv(): void {
  if (process.env.NODE_ENV !== 'production') return; // skip in dev

  const missing = REQUIRED_SERVER_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    // Crash loud so Cloud Run shows the failure in revision logs immediately
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}. ` +
      `Check Secret Manager mappings in your Cloud Run revision config.`
    );
  }
}
```

Then in `src/proxy.ts`, add at the top of the file (after imports):
```ts
import { assertServerEnv } from '@/lib/env';
assertServerEnv();
```

This runs on every cold start; fast and idempotent.

- [ ] **Step A3.3: Commit**

```bash
git add src/app/api/health/route.ts src/lib/env.ts src/proxy.ts
git commit -m "feat(infra): /api/health liveness + boot-time env validation"
```

---

#### Task A4: Production env template

- [ ] **Step A4.1: Create `.env.production.example`**

```bash
# Production environment for Cloud Run.
# In actual deployment, these come from Google Secret Manager mounted as
# env vars on the Cloud Run revision. See docs/DEPLOYMENT-GCP.md for setup.

# === Required: Supabase (NEXT_PUBLIC_* must be set at BUILD time) ===
NEXT_PUBLIC_SUPABASE_URL=https://shgsuahugiiuyopwyxtp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<eyJ... — Supabase Settings > API > anon public>
SUPABASE_SERVICE_ROLE_KEY=<eyJ... — Supabase Settings > API > service_role; needed for admin/guest flows>

# === Required: OpenAI ===
OPENAI_API_KEY=<sk-proj-... — platform.openai.com>

# === Required for voice (M3) ===
ELEVENLABS_API_KEY=<sk_... — elevenlabs.io>

# === Optional ===
# NEXT_TELEMETRY_DISABLED=1   # disabled in Dockerfile already
# NEXT_PUBLIC_APP_URL=https://survai.app   # if needed for absolute-URL generation
```

- [ ] **Step A4.2: Commit**

```bash
git add .env.production.example
git commit -m "docs(infra): .env.production.example template"
```

---

#### Task A5: Hard-fail on missing Supabase env in production

- [ ] **Step A5.1: Tighten `src/lib/supabase/server.ts`**

The current code falls back to `'http://localhost:54321'` if env vars are missing — fine for local dev safety, dangerous in prod (silently connects nowhere). Replace the fallback with a hard throw when `NODE_ENV === 'production'`.

In `src/lib/supabase/server.ts`, replace:
```ts
process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
```
with:
```ts
process.env.NEXT_PUBLIC_SUPABASE_URL ?? (process.env.NODE_ENV === 'production' ? throwMissing('NEXT_PUBLIC_SUPABASE_URL') : 'http://localhost:54321'),
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? (process.env.NODE_ENV === 'production' ? throwMissing('NEXT_PUBLIC_SUPABASE_ANON_KEY') : 'placeholder-key'),
```

Where `throwMissing` is a tiny helper added at the top of the file:
```ts
function throwMissing(name: string): never {
  throw new Error(`Missing required env var: ${name}`);
}
```

Same change in `src/lib/supabase/client.ts`.

- [ ] **Step A5.2: Commit**

```bash
git add src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "fix(supabase): fail loud on missing env in production, keep dev fallback"
```

---

## Phase B: GCP project setup (one-time, ~30 min)

You'll need: a Google account, a credit card (Cloud Run is free tier-eligible but a card is required), and the `gcloud` CLI installed.

### Tasks

- [ ] **B1: Install gcloud CLI**
  ```bash
  brew install --cask google-cloud-sdk
  gcloud auth login
  gcloud auth application-default login
  ```

- [ ] **B2: Create the GCP project**
  ```bash
  gcloud projects create survai-prod --name="Survai Production"
  gcloud config set project survai-prod
  ```
  Or use the GCP Console UI — same result.

- [ ] **B3: Link billing account**
  Console → Billing → link an account. Required for Cloud Run + Secret Manager.

- [ ] **B4: Enable required APIs**
  ```bash
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    monitoring.googleapis.com
  ```

- [ ] **B5: Create the secrets in Secret Manager**

For each secret value (Supabase service-role key, OpenAI key, ElevenLabs key):

```bash
echo -n "<value>" | gcloud secrets create supabase-service-role-key --data-file=-
echo -n "<value>" | gcloud secrets create openai-api-key --data-file=-
echo -n "<value>" | gcloud secrets create elevenlabs-api-key --data-file=-
```

Note: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are NOT secrets (the anon key is meant to be public). They get baked into the build via `--build-arg`. We could still put them in Secret Manager for hygiene; trade-off is one more lookup.

- [ ] **B6: Grant Cloud Run service account access to secrets**

  ```bash
  PROJECT_NUMBER=$(gcloud projects describe survai-prod --format="value(projectNumber)")
  for s in supabase-service-role-key openai-api-key elevenlabs-api-key; do
    gcloud secrets add-iam-policy-binding $s \
      --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
      --role="roles/secretmanager.secretAccessor"
  done
  ```

---

## Phase C: First deploy (~20 min)

- [ ] **C1: Deploy from source**

From the repo root:
```bash
gcloud run deploy survai \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 120 \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://shgsuahugiiuyopwyxtp.supabase.co,NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,OPENAI_API_KEY=openai-api-key:latest,ELEVENLABS_API_KEY=elevenlabs-api-key:latest \
  --build-env-vars NEXT_PUBLIC_SUPABASE_URL=https://shgsuahugiiuyopwyxtp.supabase.co,NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

**Why each flag:**
- `--allow-unauthenticated` — public-facing app, no GCP IAM gate
- `--port 8080` — matches Dockerfile EXPOSE
- `--memory 1Gi` — Next.js builds need ~512MB headroom; 1GB is safe
- `--min-instances 0` — scale to zero when idle ($0 cost)
- `--max-instances 10` — cap to avoid runaway billing
- `--concurrency 80` — Cloud Run default; one instance handles 80 simultaneous reqs
- `--build-env-vars` is the magic for NEXT_PUBLIC_*: passes them as build args to the Dockerfile so they're baked into the client bundle
- `--set-secrets` mounts Secret Manager values as runtime env vars (not visible in revision config)

This command takes 4–8 minutes the first time (Cloud Build pulls Node, npm installs, builds Next, pushes image, deploys revision).

- [ ] **C2: Smoke the URL**

```bash
URL=$(gcloud run services describe survai --region us-central1 --format='value(status.url)')
echo "App is at: $URL"
curl -s "$URL/api/health"
# Expect: {"ok":true,"ts":"...","version":"survai-00001-xyz"}
curl -s -o /dev/null -w "%{http_code}\n" "$URL/"
# Expect: 200
curl -s -o /dev/null -w "%{http_code}\n" "$URL/dashboard"
# Expect: 307 (redirect to /login)
```

If any of these fail, check Cloud Run revision logs:
```bash
gcloud run services logs read survai --region us-central1 --limit 50
```

- [ ] **C3: Update Supabase auth allowed redirect URLs**

In the Supabase Dashboard → Authentication → URL Configuration:
- Add `https://<your-cloud-run-url>` to "Site URL" temporarily
- Add `https://<your-cloud-run-url>/auth/callback` to "Redirect URLs"

This is required for Google OAuth to work with the deployed app. (Email/password signin doesn't need it but OAuth does.)

- [ ] **C4: Run the smoke chain via the deployed URL**

Same chain as `docs/BACKEND-AUDIT.md` — login, create, publish, anon submit, owner reads. But against the Cloud Run URL instead of localhost.

If everything green: **the app is live, accessible from anywhere on the internet.** Survey share links work for real respondents.

---

## Phase D: Custom domain + TLS (~30 min, mostly DNS waiting)

- [ ] **D1: Buy the domain**

Cloud Domains in GCP, or Namecheap, or any registrar. ~$10-15/year for .com or .app.

- [ ] **D2: Map the domain to Cloud Run**

Cloud Console → Cloud Run → your service → Manage Custom Domains → Add Mapping. Or:
```bash
gcloud beta run domain-mappings create --service survai --domain survai.app --region us-central1
```

GCP gives you DNS records (an A record + AAAA, or a CNAME). Add them at your registrar.

- [ ] **D3: Wait for cert provisioning (5–60 min)**

Google issues a managed SSL cert as soon as DNS resolves. Status visible in the Cloud Run console.

- [ ] **D4: Update Supabase redirect URLs to the real domain**

Replace the temporary `*.run.app` URL with `https://survai.app` in Supabase Auth → URL Configuration.

- [ ] **D5: Smoke the real domain**

```bash
curl -s https://survai.app/api/health
# Expect: 200 with {"ok":true,...}
```

Open `https://survai.app/signup` in a browser — sign up a real test user — verify the full chain works.

---

## Phase E: Production hardening (post-launch tasks)

These are NOT blockers for first deploy. Fold in over the next sprint after you've shown 1-2 people.

### E1: Enable email confirmation
In Supabase → Auth → Providers → Email → check "Confirm email". Required for anti-spam on a public signup form.

### E2: Set min-instances=1 (optional, costs ~$15/month)
Eliminates cold-start latency for users. Not required for MVP demo.

```bash
gcloud run services update survai --min-instances 1 --region us-central1
```

### E3: Uptime check
Cloud Console → Monitoring → Uptime checks → Add. Target `https://survai.app/api/health`. Alert on failure.

### E4: Log-based error alert
Cloud Logging → Logs Explorer → query `severity=ERROR resource.type="cloud_run_revision" resource.labels.service_name="survai"` → "Create alert from query". Threshold: >5 errors in 5 min.

### E5: GitHub Actions auto-deploy on `main` push

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloud Run
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: |
          gcloud run deploy survai --source . --region us-central1 \
            --build-env-vars NEXT_PUBLIC_SUPABASE_URL=${{ secrets.SUPABASE_URL }},NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}
```

Requires Workload Identity Federation setup (one-time, ~15 min — a Google blog post walks through it). Skips storing GCP credentials in GitHub.

### E6: Backup + disaster recovery
- Supabase Pro tier ($25/mo) gives PITR (point-in-time recovery). For first 100 users, free-tier daily backup is fine.
- All code in git. Cloud Build keeps 1 prior image automatically. Cloud Run keeps the last 100 revisions; rollback = 1 click.

### E7: Rate limit `/api/ai/*`
Once users hit the AI features and OpenAI bills start showing, add a simple per-IP rate limiter (Vercel-style: in-memory LRU). Skipped per MVP scope.

### E8: `/api/webhooks/elevenlabs` becomes reachable
The whole point of GCP deploy is making this URL public. M3 (voice + phone) becomes implementable once C-1 ships.

---

## Cost estimate

For 1-2 demo users, MVP traffic:

| Service | Cost |
|---|---|
| Cloud Run (scale-to-zero, ~100 reqs/day) | $0–1/month |
| Cloud Build (5 deploys/month) | $0 (free tier) |
| Cloud Storage (Artifact Registry, ~500MB) | $0 (free tier) |
| Secret Manager (3 secrets, low access volume) | $0 (free tier) |
| Cloud Logging (small volume) | $0 (free tier covers ~50GB/month) |
| Cloud DNS (if used) | $0.20/month |
| Domain registration | $1/month amortized |
| **Supabase free tier** | $0 |
| **OpenAI API** | $5–50/month depending on AI usage (the real cost) |
| **ElevenLabs** | $5–22/month (Creator tier required for Conversational AI in M3) |
| **TOTAL** | **~$10–80/month** depending on AI/voice usage |

Scaling to 100 users: probably still under $200/month — Cloud Run is the cheap part; AI usage is the variable.

---

## What's deferred (call out so we don't pretend it's done)

| Deferred | Why |
|---|---|
| Multi-region / global LB | Single-region us-central1 is fine for <10K MAU |
| CDN for static assets | Cloud Run's automatic edge caching handles `_next/static/` adequately for MVP |
| Database read replicas | Supabase free tier doesn't offer them; not needed at our scale |
| Sentry / error tracking SDK | Cloud Logging + log-based alerts cover MVP |
| Posthog / product analytics | Not in MVP scope |
| WAF / Cloud Armor | Cloud Run sits behind Google's edge network already; CSP headers cover most XSS |
| Per-user / per-IP rate limits | Skipped per MVP direction |
| File storage (Supabase Storage or GCS) | `file_upload` element currently uses inline data URIs which Supabase handles in the JSONB schema. Real file storage waits until upload sizes matter. |
| Email transactional service (SendGrid etc.) | Supabase email rate limits are fine for confirmation emails on demo traffic |
| Migration step in CI | Migrations applied manually via Supabase Dashboard or MCP for now |
| Preview deployments per PR | Adds complexity; not needed for solo MVP |

---

## Self-review

**Does this actually get to "stand-alone product running on GCP"?**
- ✅ Public HTTPS URL? Yes — Phase C gives `*.run.app`, Phase D gives custom domain
- ✅ Survey share links work from any browser? Yes — that's literally the publish-link goal
- ✅ Webhooks have public endpoints? Yes — needed for M3 voice/phone
- ✅ Logs centralized + searchable? Yes — Cloud Logging
- ✅ Secrets not in git? Yes — Secret Manager
- ✅ Reproducible deploys? Yes — Dockerfile + `gcloud run deploy --source .`
- ✅ Rollback story? Yes — Cloud Run revision history, 1-click rollback
- ✅ Acceptable cold start? Yes — ~1-2s, fine for survey-link traffic which is bursty anyway

**Does it stay an MVP, not over-engineered?**
- No GKE, no Cloud SQL, no VPC, no load balancer
- No CI/CD as blocker (manual gcloud is fine)
- No Sentry, no Datadog, no Posthog
- No multi-region, no CDN config
- No rate limiting, no captcha
- Total new infra files: 4 (Dockerfile, .dockerignore, .env.production.example, /api/health/route.ts)

**Time estimate end-to-end:**
- Phase A (backend code): ~2 hours
- Phase B (GCP setup): ~30 min
- Phase C (first deploy): ~20 min including Cloud Build wait
- Phase D (domain): ~30 min + DNS propagation
- Phase E (hardening): pick-and-choose, no fixed deadline

Total to "live at survai.app": **~half a day** of focused work, plus DNS propagation wait.

**Risks / failure modes:**

1. **NEXT_PUBLIC_* not baked correctly.** Most common Next.js + Cloud Run failure. Mitigated by `--build-env-vars` flag in C1 + Dockerfile ARG/ENV pattern.
2. **Standalone build incompatibility.** Some libraries (rare) don't work with Next's standalone output. Mitigated by Step A1.3 local verification.
3. **Cold-start timeouts.** First request after idle takes ~2s. If a user happens to hit publish at that exact moment, they wait. Mitigated by min-instances=1 if it becomes a UX issue.
4. **Supabase rate limits on email confirmation.** If you turn confirmation back ON in production, the free tier rate limits real users. Mitigated by upgrading Supabase or wiring SendGrid/Resend before you market the URL.
5. **OAuth callback misconfiguration.** Forgetting to add the production URL to Supabase + Google Cloud Console will break Google sign-in. Mitigated by C3 + D4 explicit steps.
6. **Custom domain DNS propagation.** Can take up to 48h; usually <1h. Plan launch communication accordingly.
7. **Service-role key in client somehow.** Catastrophic — would let anyone bypass RLS. Mitigated by Dockerfile ARG separation (only `NEXT_PUBLIC_*` are build-args; service role is runtime-only secret).

**What I'd want to confirm before executing:**
1. Do you want to use Cloud Domains (within GCP) or an external registrar (Namecheap etc.)?
2. Are you OK with `us-central1` region, or want EU/Asia for latency?
3. Should I set up GitHub Actions auto-deploy in this milestone, or defer to post-launch?
4. Is `survai.app` available — or do you have another domain in mind?
