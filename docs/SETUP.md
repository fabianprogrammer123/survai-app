# Setup — Local Dev Environment

How to clone Survai and get to a working `npm run dev` against your own Supabase project.

If you're connecting to the **existing project** (`shgsuahugiiuyopwyxtp` for the Survai team), skip to step 4 and copy the existing `.env.local` keys from the Supabase dashboard.

If you're spinning up a **fresh project**, follow steps 1–6.

---

## Prerequisites

- Node 22+ and npm 10+
- A Supabase account (free tier is enough)
- An OpenAI API key (`sk-proj-...`)
- (Optional) An ElevenLabs API key — only needed for voice mode

---

## 1. Clone + install

```bash
git clone https://github.com/fabianprogrammer123/survai-app.git
cd survai-app
npm install
```

## 2. Create a Supabase project

1. Go to https://supabase.com → New Project
2. Pick the closest region to your users
3. Set a strong DB password (you won't need it day-to-day)
4. Wait ~2 min for provisioning

## 3. Apply the database schema

In the Supabase Dashboard → SQL Editor, run **every file in `supabase/migrations/` in filename (lexical) order**:

```
supabase/migrations/20260417000000_base_schema.sql
supabase/migrations/20260419000000_ai_traces.sql
supabase/migrations/20260419000100_rls_guests_token.sql
supabase/migrations/20260419000200_responses_idempotency.sql
```

Each file is **idempotent** — safe to re-run. The base schema creates 5
tables (`surveys`, `responses`, `chat_messages`, `guests`, `ai_traces` —
the last one is added by the second migration) with RLS, the
`is_survey_published` helper, and indexes. The later migrations tighten
guests-table RLS (no anon read) and add webhook idempotency for
`responses`.

Running only the base schema leaves you missing `ai_traces` and the
webhook idempotency index. Running it on an older deploy that had the
insecure `"Public read by token"` policy will drop that policy — which
is the intended state.

After running, verify in Dashboard → Database → Tables that the five
tables show up with the green RLS shield, and that
`curl $SUPABASE_URL/rest/v1/guests?select=* -H "apikey: $ANON_KEY"`
returns `[]` (not a row dump).

## 4. Disable email confirmation (MVP only)

In the Dashboard → Authentication → Providers → Email:
- **Uncheck "Confirm email"**

Without this, signups try to send confirmation emails and trip the free-tier rate limit. Re-enable for production.

## 5. Configure environment variables

Create `.env.local` in the repo root (it's gitignored):

```bash
# Supabase — Settings → API in your project dashboard
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # "anon public" key
SUPABASE_SERVICE_ROLE_KEY=                  # leave empty for MVP, only needed for guest-invite flow

# OpenAI — required for AI editor features
OPENAI_API_KEY=sk-proj-...

# ElevenLabs — required for voice mode (M3); skip for now
ELEVENLABS_API_KEY=
```

The Supabase URL + anon key are public-safe (the anon key is gated by RLS). The service-role key is **secret** — never commit it, never expose it client-side.

## 6. Boot the dev server

```bash
npm run dev
```

Default port is 3000. The frontend agent's worktree uses 3003; the backend worktree uses 3004 — set `PORT=<n>` if you need a different one.

Then open http://localhost:3000 (or whatever port).

---

## First-run smoke test

1. Visit http://localhost:3000/signup, create a user with any email + a password ≥6 chars.
2. You should auto-redirect to `/dashboard`.
3. Click "New Survey" → lands on `/survey/<uuid>/edit`.
4. Type a title, wait 2s — auto-save fires (visible in browser DevTools → Network as a PATCH to `surveys`).
5. Open the publish dialog → "Share" tab → copy the link.
6. In an incognito window, paste the link → fill out + submit a question.
7. Back in your logged-in window, go to `/survey/<uuid>/responses` — your answer should be there.

If any step fails, see [docs/BACKEND-AUDIT.md](BACKEND-AUDIT.md) for the verified state baseline and known limitations.

---

## Working with worktrees (two parallel agents)

This repo currently has two long-running branches under `.worktrees/`:

```
.worktrees/test-ux-polish/   →  feat/dashboard-google-forms (frontend agent, port 3003)
.worktrees/backend-prod/     →  feat/backend-production (backend agent, port 3004)
```

Each worktree is its own independent checkout sharing the same `.git`. To run dev servers in both at once, use distinct ports.

To create your own worktree:
```bash
git worktree add .worktrees/my-feature -b feat/my-feature
cp .env.local .worktrees/my-feature/.env.local
cd .worktrees/my-feature
npm install
PORT=3005 npm run dev -- --port 3005
```

---

## Common issues

**"Failed to create survey" on dashboard click**
- Check the browser console / Network tab for the exact response. `401 unauthorized` means session expired (re-login). `500 internal` means check the dev server log for the underlying Supabase error.

**Signup fails with `over_email_send_rate_limit`**
- Email confirmation is on at the Supabase project. See step 4. Toggle it off.

**`/dashboard` always redirects to `/login`**
- That's the proxy gate doing its job — you're not logged in. Sign in first.

**Survey publishes but `/s/<id>` returns 404**
- The survey wasn't actually marked `published=true`. Check the dev server log for the publish API response, and verify in Supabase Dashboard → Table Editor → surveys.

**Auto-save fails silently**
- `useAutoSave` writes via the client Supabase client. Check Network tab for the PATCH and Supabase log for any RLS errors. Most common cause: stale session.

**Frontend changes break the backend or vice versa**
- See [docs/BACKEND-API.md](BACKEND-API.md) — frontend should only depend on the documented API contract. If frontend writes directly to Supabase from the client, that's a coupling we should fix by adding a server route.
