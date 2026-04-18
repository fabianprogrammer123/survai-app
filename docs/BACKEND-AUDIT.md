# Backend Audit — M0 Foundation State

**Date verified:** 2026-04-17
**Branch:** `feat/backend-production` (commits 8b120ab → 6162101)
**Live Supabase project:** `shgsuahugiiuyopwyxtp` (Survai, eu-east-1, Postgres 17, ACTIVE_HEALTHY)

This document captures the verified backend state at the end of M0. Everything below was tested against the live project, not theorized. If something breaks later, this is the baseline to compare against.

---

## What's verified working

| Capability | How verified |
|---|---|
| User can log in (email + password) | Manual: signed in as `e2etest@survai.local` via the UI at `/login` |
| Proxy gates protected routes | `curl -I /dashboard` while anon → `307 → /login?next=/dashboard` |
| Authenticated user can create a survey | `POST /api/surveys` with Bearer token → 201 with new SurveyRow |
| Dashboard "New Survey" button uses the API | `dashboard-content.tsx` `handleCreate` posts to `/api/surveys` |
| Survey owner can publish | `POST /api/surveys/[id]/publish` → sets `published=true`, `published_at` |
| `/s/[id]` respondent page loads published surveys | `curl /s/<uuid>` → 200 |
| Anonymous respondent can submit a response | `POST /api/surveys/[id]/submit` with answers payload → `{success:true}` |
| Survey owner can read submitted responses | REST query against `responses` with owner Bearer token returns the row |
| RLS isolates owner data | Owner-A's published survey is anon-readable; non-published survey is anon-blocked |
| Structured logs land on stdout | `tail /tmp/survai-backend-dev.log` shows `{"event":"response.submitted",...}` lines |

The full chain (login → create → publish → anon submit → owner read) was run end-to-end against the live Supabase project on 2026-04-17. All steps green.

---

## Database state — public schema

### Tables (RLS enabled on all four)

```
public.surveys         (12 cols, RLS, FK→auth.users)
public.responses       (6 cols,  RLS, FK→surveys)
public.chat_messages   (6 cols,  RLS, FK→surveys)
public.guests          (10 cols, RLS, FK→surveys + responses)
```

### Helper function

```sql
public.is_survey_published(p_survey_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
```

Used by the responses INSERT policy. Lives in the canonical migration.

### RLS policies

| Table | Policy | For | Check |
|---|---|---|---|
| surveys | Owner full access | ALL | `auth.uid() = user_id` |
| surveys | Public read published | SELECT | `published = true` |
| responses | Insert to published surveys | INSERT | `is_survey_published(survey_id)` |
| responses | Owner reads responses | SELECT | owner-only via `surveys` join |
| chat_messages | Owner manages chat | ALL | owner-only via `surveys` join |
| guests | Owner manages guests | ALL | owner-only via `surveys` join |
| guests | Public read by token | SELECT | `true` (filtered in app layer by token) |

### Default-value tricks

- `surveys.user_id DEFAULT auth.uid()` → owner inserts don't need to pass user_id
- `surveys.id DEFAULT gen_random_uuid()`
- `responses.id DEFAULT gen_random_uuid()`
- `surveys.updated_at` auto-touched via `surveys_updated_at` trigger calling `public.update_updated_at()`

### Migrations applied to live project

```
20260418031828  base_schema
20260418033316  surveys_user_id_default
20260418033507  fix_responses_insert_policy
```

Local mirror: `supabase/migrations/20260417000000_base_schema.sql` is a single canonical file containing all three changes consolidated. Fresh clones run that one file and get the fully-fixed schema.

---

## Auth state

- **Provider:** Email + password (Supabase built-in)
- **Email confirmation:** Currently **ON** at the project level. This blocks self-signup for the demo (signup hits a rate limit because Supabase tries to send a confirmation email). For MVP demo, **toggle this OFF** at https://supabase.com/dashboard/project/shgsuahugiiuyopwyxtp/auth/providers → Email → uncheck "Confirm email". This is a one-click manual step we couldn't automate via MCP (Supabase auth config isn't in SQL).
- **OAuth:** Google OAuth wiring exists in `/login` and `/auth/callback`, but not exercised in M0 (would require setting Google client credentials in the Supabase dashboard).
- **Test user (created via SQL during M0 verification):** `e2etest@survai.local` / `TestPassword123!`. Pre-confirmed. Safe to delete via the Supabase dashboard or `DELETE FROM auth.users WHERE email = 'e2etest@survai.local';`

---

## What changed in this milestone

### New files
- `src/lib/log.ts` — structured JSON logger
- `src/lib/api/errors.ts` — typed error envelope helpers
- `src/lib/api/schemas.ts` — Zod request/response schemas for `/api/surveys`
- `src/app/api/surveys/route.ts` — POST handler (create survey)
- `src/proxy.ts` — replaces middleware.ts (Next.js 16 rename) with active gating
- `supabase/migrations/20260417000000_base_schema.sql` — canonical, idempotent
- `docs/BACKEND-AUDIT.md`, `docs/BACKEND-API.md`, `docs/SETUP.md` — these docs
- `supabase/migrations/README.md`

### Modified files
- `src/app/api/surveys/[id]/submit/route.ts` — anon client + RLS, no RETURNING
- `src/app/(auth)/login/page.tsx` — honors `?next=` redirect param
- `src/components/dashboard/dashboard-content.tsx` — `handleCreate` POSTs to API
- `playwright.config.ts` — baseURL now `:3004` for this worktree

### Deleted files
- `src/middleware.ts` (moved to `src/proxy.ts`)
- `supabase/migrations/001_initial_schema.sql` (older, missing tables/columns)
- `supabase-ddl.sql` (root-level duplicate, promoted into proper migration)

---

## What's deliberately NOT done (deferred to later milestones)

| Deferred | Why deferred | Where it lives |
|---|---|---|
| Sign-out button + user menu | Can be done in M1-lite; not blocking M0 share-link goal | M1-lite |
| `/survey/[id]/responses` UI verification | Backend works (verified via REST); UI render is frontend agent's surface | M1-lite |
| CSV export of responses | Nice-to-have for first demo | M1-lite |
| 404 / 500 styled error pages | Polish | M1-lite |
| Forgot password / reset | Not needed for 1-2 demo users | Post-MVP |
| Email verification UI | Skipped per MVP scope (confirmation should be off anyway) | Post-MVP |
| Account deletion / GDPR | Not needed before public launch | Post-MVP |
| Rate limiting on `/api/ai/*` | Skipped per user direction (MVP, not worried about cost) | Post-MVP |
| Captcha on `/s/[id]/submit` | Skipped per user direction | Post-MVP |
| Sentry / error monitoring | Skipped per user direction (logs land on stdout, sufficient for MVP) | Post-MVP |
| GCP deployment | Documented in `docs/DEPLOYMENT-GCP.md` (M2-doc) — not yet executed | M2-doc |
| ElevenLabs voice agent end-to-end | Routes exist but not exercised | M3 (the headline feature) |
| Twilio phone campaigns | Routes exist (`/api/elevenlabs/batch`) but not wired to a phone number | M3 |
| Guest token personalized invites | Schema + routes exist, no editor UI to send invites | M3 |

---

## Known limitations

1. **`SUPABASE_SERVICE_ROLE_KEY` is empty in `.env.local`.** Most of the app works without it (anon client + RLS handles everything). The only routes that need it: `/api/surveys/[id]/submit` (only the optional guest-token branch — basic submission works without), and any future admin scripts. For M0 we deliberately did not set it so the runtime stack is anon-only.

2. **Symlinked-vs-real `node_modules` quirk in worktrees.** The backend worktree has a real `npm install`. The frontend worktree may have either. If you run `npm install` in one and the lockfile changes, run it in the other too.

3. **The `/test` flow is still localStorage-only**, deliberately. It's the try-before-signup funnel. Surveys created at `/test/edit` never get a Supabase ID, so the publish dialog falls back to a base64 preview URL (this is by design). Real share links require the authenticated `/dashboard → New Survey → /survey/[id]/edit` path.

4. **Publish dialog conflates "publish for sharing" with "generate mock AI responses"** — clicking "Publish & Generate" both publishes the real survey AND generates fake responses for demo. The "Share" tab gives a clean copy-link experience. Frontend agent owns this UX.

5. **Email confirmation is on** at the Supabase project level. New self-signups will fail until you toggle it off in the dashboard.

---

## How to re-run the verification chain

```bash
# 1. Boot the worktree dev server on 3004 (if not already running)
cd /Users/fabian/Desktop/Coding_projects/survai/.worktrees/backend-prod
PORT=3004 npx next dev --port 3004 &

# 2. Confirm the smoke-test chain via the Supabase REST + your /api routes
SUPA_URL="https://shgsuahugiiuyopwyxtp.supabase.co"
SUPA_ANON=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-)

# Sign in as the test user
SIGNIN=$(curl -s -X POST "$SUPA_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPA_ANON" -H "content-type: application/json" \
  -d '{"email":"e2etest@survai.local","password":"TestPassword123!"}')
TOKEN=$(echo "$SIGNIN" | grep -oE '"access_token":"[^"]+"' | sed 's/"access_token":"//;s/"$//')

# Create + publish a survey via REST
SURVEY=$(curl -s -X POST "$SUPA_URL/rest/v1/surveys" \
  -H "apikey: $SUPA_ANON" -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" -H "Prefer: return=representation" \
  -d '{"title":"audit run","schema":[{"id":"el_1","type":"short_text","title":"Q?"}]}')
SID=$(echo "$SURVEY" | grep -oE '"id":"[a-f0-9-]+' | head -1 | sed 's/"id":"//')

curl -s -X PATCH "$SUPA_URL/rest/v1/surveys?id=eq.$SID" \
  -H "apikey: $SUPA_ANON" -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"published":true,"published_at":"now()"}' >/dev/null

# Anon submit
curl -s -X POST "http://localhost:3004/api/surveys/$SID/submit" \
  -H "content-type: application/json" \
  -d '{"answers":{"el_1":"audit response"}}'

# Owner reads
curl -s "$SUPA_URL/rest/v1/responses?survey_id=eq.$SID&select=id,answers" \
  -H "apikey: $SUPA_ANON" -H "Authorization: Bearer $TOKEN"
```

Expected: `{"success":true}` from submit, then a JSON array with the response from the owner read.
