# Security

How Survai is hardened today, how to rotate secrets, and what to do when
something leaks. This file lives next to the code so it stays current
with the codebase.

Report a suspected vulnerability to **fabian.hildesheim@cdtm.com**.
Please do not open a public GitHub issue for anything exploitable.

---

## 1. Threat model summary

Who can call what, with what auth:

| Surface | Caller | Gate |
| --- | --- | --- |
| `/` landing, `/test*` | anyone | public; no data leaves Supabase |
| `/s/:id`, `/s/:id?t=:token` | respondent | guest token validated server-side; anon reads of `guests` blocked at RLS |
| `/dashboard`, `/survey/:id/*` | creator | Supabase session; `src/proxy.ts` redirects anon to `/login` |
| `/api/surveys/*` (owner tools) | creator | route handler checks ownership against `auth.uid()` |
| `/api/surveys/:id/submit` | anon respondent | anon allowed; RLS `is_survey_published` gates inserts to published surveys only |
| `/api/surveys/:id/guests/:token` | anon respondent | token lookup via service-role client; wrong token → 404 |
| `/api/ai/chat/*` | anon (`/test` demo) | anon allowed, rate-limited, no server-side data mutation |
| `/api/ai/responses`, `/api/ai/image` | creator | `requireAuth()` — 401 for anon |
| `/api/elevenlabs/agent`, `/batch`, `/call`, `/tts` | creator | `requireAuth()` — 401 for anon |
| `/api/elevenlabs/signed-url` | anon respondent | anon allowed; scoped 15-min URL for a specific `agentId` |
| `/api/webhooks/elevenlabs` | ElevenLabs | HMAC-SHA256 verification with 30-minute replay window |
| `/api/health` | Cloud Run probe | anon, rate-limit bypass |

Everything under `/api/*` (except `/api/health` and `/api/webhooks/*`)
passes through the in-memory per-IP sliding-window rate limiter in
[`src/lib/api/rate-limit.ts`](src/lib/api/rate-limit.ts).

---

## 2. Where secrets live

**In the repository: nothing.** `.env*` is gitignored; only
`.env.example` and `.env.production.example` are tracked.

**At runtime (Cloud Run, project `survai-app`):** Google Secret Manager
entries, mounted via `--set-secrets` in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

| Env var | Secret Manager entry | Used by |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `anthropic-api-key` | AI chat + dummy-response generation |
| `OPENAI_API_KEY` | `openai-api-key` | DALL-E background images |
| `ELEVENLABS_API_KEY` | `elevenlabs-api-key` | Agent provisioning, TTS, outbound calls |
| `ELEVENLABS_WEBHOOK_SECRET` | `elevenlabs-webhook-secret` | HMAC verification on `/api/webhooks/elevenlabs` |

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not
secrets — the anon key is designed to be public, and RLS protects data.
They are passed via `--set-env-vars` in the same workflow so they end
up baked into the client bundle at build time.

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is used by the webhook
handler and guest-token lookup. If it is not present in the Cloud Run
revision, those code paths fail closed (webhook returns 500, guest
lookup returns a mock in dev or an error in prod). Add it to Secret
Manager and to the `--set-secrets` line if you intend to run the
respondent flow end-to-end.

**Local development:** values live in `.env.local` (gitignored). Never
commit this file.

---

## 3. Rotating a secret

Every rotation follows the same shape: push the new value into Secret
Manager as a new version, redeploy Cloud Run, then revoke the old
value at the provider. Order matters — revoking first causes downtime.

### Anthropic / OpenAI / ElevenLabs API keys

1. Generate a replacement key at the provider dashboard.
2. `gcloud secrets versions add <name> --data-file=-` (paste the new key).
3. Trigger a redeploy (push to `main` or run the `deploy.yml` workflow
   via the Actions tab). Cloud Run resolves `:latest` at revision
   creation time.
4. Confirm `GET /api/health` returns 200 on the new revision, then
   disable / revoke the old key at the provider.

### ElevenLabs webhook secret

This is the one rotation that requires a **coordinated change window**:
the secret is verified on every webhook, so any drift between our end
and ElevenLabs' end causes verification to fail.

1. Pick a new secret: `openssl rand -hex 32`.
2. `gcloud secrets versions add elevenlabs-webhook-secret --data-file=-`.
3. Redeploy Cloud Run and wait for the new revision to receive traffic.
4. Update the same secret in the ElevenLabs agent webhook settings.
5. Validate: trigger a real voice conversation; check
   `webhook.elevenlabs.persisted` appears in Cloud Logging with no
   `webhook.elevenlabs.invalid_signature` warnings.

### Supabase anon key

Regenerating the anon key forces a redeploy (it is baked into the
client bundle).

1. Supabase dashboard → Settings → API → Generate new anon key.
2. Update `--set-env-vars` in `deploy.yml` (and any local `.env.local`).
3. Commit + push to trigger a rebuild.

### Supabase service-role key

Bypasses RLS; treat this like a root credential.

1. Supabase dashboard → Settings → API → Reset service role key.
2. Push the new value to Secret Manager under
   `supabase-service-role-key` and add it to `--set-secrets` in
   `deploy.yml` if not already present.
3. Redeploy.

---

## 4. Leak response runbook

Act on suspicion, not proof. The cost of a false alarm is low; the
cost of a real leak that sat for hours is high.

### If an API key (Anthropic / OpenAI / ElevenLabs) is exposed

1. **Revoke at the provider immediately** — the console lets you delete
   or disable the key. This is the single most important step.
2. Generate a replacement key.
3. Rotate per the runbook above (§3).
4. Check the provider's usage / billing page for anomalous spikes in
   the leak window.
5. Open a retrospective note: where did the leak come from (log line,
   screenshot, commit, …)? Fix the source so it doesn't recur.

### If the ElevenLabs webhook secret is exposed

1. Rotate the secret (§3). Webhooks signed with the old secret start
   failing as soon as the new revision serves traffic.
2. Scan Cloud Logging for `webhook.elevenlabs.invalid_signature` in
   the window between the leak and the rotation — any entry is a
   possible forged-insert attempt. Cross-reference with new rows in
   `responses`.

### If the Supabase service-role key is exposed

1. Reset the key in the Supabase dashboard. This invalidates the old
   key instantly, which **will cause downtime** until the redeploy
   lands (webhook + guest-token paths). Accept the downtime.
2. Rotate per §3.
3. Audit `responses`, `surveys`, and `guests` for rows created in the
   leak window that don't match any legitimate session or webhook.

### If the Supabase anon key is exposed

The anon key is meant to be public and is subject to RLS. A leak is
not by itself a breach. Still worth rotating if the exposure is
embarrassing (blog post, public repo, etc.) — follow §3.

### If a database row or user data leaks

1. Contain: identify the query path and disable it (merge a guard
   revert). Prefer a narrow fix over a whole-service takedown.
2. Scope: query `responses` / `guests` / `surveys` for the set of rows
   involved.
3. If the leak includes EU-resident respondent data, the GDPR clock
   starts. 72-hour supervisory-authority notification window applies
   to personal data breaches under Art. 33.
4. Notify affected users through their logged email.

---

## 5. Known gaps and follow-ups

These are not bugs; they're deliberate v1 tradeoffs.

- **Rate limiter is per-instance.** Counters live in a Map inside
  `src/lib/api/rate-limit.ts`. Cloud Run with `min-instances=0` resets
  them on cold start; a patient attacker can pause ~15 minutes and
  refill quota. Moving to Redis is the follow-up once we run more than
  one instance.
- **No respondent voice auth.** `/api/elevenlabs/signed-url` is anon
  because Stream B needs it callable from the respondent browser. The
  signed URL itself is scoped (specific `agentId`, 15-minute TTL), but
  an attacker with a published agent ID can start sessions.
- **No production observability platform.** Cloud Run's stdout capture
  into Cloud Logging is the only pipeline. Sentry / Datadog is a
  separate stream; in the meantime every error path emits a
  structured `log.error` so the relevant events are searchable.
- **No data retention policy.** Voice transcripts in
  `responses.metadata.transcript` are kept indefinitely. If we take
  EU traffic this needs an explicit retention + deletion story.
- **Service role key not pinned in the deploy workflow.** Tracked in
  §2 above. If the webhook/guest paths fail silently after a deploy,
  this is the first place to look.

---

## 6. Pre-release security checklist

Before each significant release, walk through this list:

- [ ] `curl -X POST https://sur-ways.com/api/ai/responses -d '{}'` → 401
- [ ] `curl -X POST https://sur-ways.com/api/elevenlabs/agent -d '{}'` → 401
- [ ] `curl https://sur-ways.com/api/webhooks/elevenlabs -X POST -d '{}' -H 'elevenlabs-signature: t=0,v0=0'` → 401
- [ ] Hammer `/api/ai/chat/test` 201 times from a single IP → 429 on the final request
- [ ] Fetch the guests table via the anon Supabase REST endpoint → `[]`
- [ ] Double-post a valid webhook with the same `conversation_id` → one row in `responses`
- [ ] Cloud Logging shows structured JSON lines for the above interactions
- [ ] No secrets committed in the new changeset (`git log --all -S 'sk-'` scratch check)
