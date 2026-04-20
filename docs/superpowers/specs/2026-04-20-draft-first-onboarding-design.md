# Draft-first onboarding with passwordless auth — design

Date: 2026-04-20
Status: approved (in-conversation 2026-04-20)

## Motivation

Today the landing page's primary CTA is "Start Building" → `/signup`. That
drops prospective users into a signup wall before they've experienced
the product, which is the product's main differentiator. We also
require a password that most users will immediately forget.

## Goals

- "Start Building" lands the visitor directly in an editor with a
  blank draft that persists through reloads.
- The only auth gate is **Publish**. Browsing and editing are free.
- Sign-in is passwordless: email OTP (6-digit code) or Google.
- No lost work across the login hop — drafts claim onto the account.

## Non-goals

- Device-portable anonymous drafts (claim is per-browser, via
  localStorage).
- Consolidating `/test` and `/dashboard`.
- Moving the rate limiter off the in-memory Map (handover #7).

## User flow

```
Landing ── Start Building ──▶ /test/edit?id=<fresh>       (localStorage)
                                     │
                                     ├─ user edits, AI assists
                                     │
                                     └─ clicks Publish
                                          │
                  (unauth)                │                  (auth)
                     │                    │                    │
                     ▼                                         ▼
        stash pending payload,                       existing publish path:
        redirect /login?next=/claim-draft            agent + AI responses +
                     │                               DB persist, no change
                     ▼
            /login — email OTP
            or Google
                     │
                     ▼
            /claim-draft (authed):
            POST /api/surveys with
            title/desc/schema/settings,
            delete local index entry,
            redirect /survey/<id>/edit?autopublish=1
                     │
                     ▼
            Editor auto-opens Publish
            dialog and fires publish
```

Only the Publish button gates on auth. **Share** (copy preview link)
stays demo-able without signing up.

## Component changes

### Auth — one passwordless screen

`/login` becomes a two-step form in a single file:
1. email input → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`.
2. 6-digit code input → `supabase.auth.verifyOtp({ email, token, type: 'email' })`.

Google button sits above, unchanged. "Resend code" and "use a
different email" controls on step 2. `?next=<relative-path>` is
honored through the whole cycle, OAuth callback included. Password
field removed.

`/signup` replaces its entire body with a server-side `redirect('/login')`
(Next.js `redirect` from `next/navigation` inside a server component).
Keeping the file rather than deleting preserves any inbound links and
the OAuth redirect-to URLs.

### Landing + "Start Building"

- Landing hero CTA and nav both route to `/test/edit` (Start Building)
  and `/login` (Sign In).
- `/test/edit` without `id` auto-mints a new local draft (blank
  template, default style), writes to localStorage, `router.replace`s
  the URL to include the new id. This collapses the dashboard step;
  returning users can still reach the dashboard at `/test`.

### Pending-publish stash

New helpers in `src/lib/survey/local-surveys.ts`:

- `setPendingPublish(payload: PendingPublish)`
- `consumePendingPublish(): PendingPublish | null` — returns + deletes
- `hasPendingPublish(): boolean`

Shape:
```ts
interface PendingPublish {
  localSurveyId: string;
  count: number;             // respondentCount
  generateResponses: boolean;
  createdAt: number;         // ms epoch
}
```

TTL = 24h, enforced in `consume` and `has`.

### Publish interception

`PublishDialog.handlePublish` pre-flight:
- If `!isDbSurvey` **and** `supabase.auth.getSession()` resolves to
  `null`: stash pending payload + `router.push('/login?next=/claim-draft')`.
  No agent creation, no AI response generation, no partial state.
- Otherwise: existing behavior.

### /claim-draft

New file `src/app/claim-draft/page.tsx`, client component (reads
localStorage). Flow:
1. Read pending payload; if missing or stale → `router.replace('/test')`.
2. Load the local survey by id; if missing → show "Draft expired"
   with a link back to `/test`.
3. `POST /api/surveys` with `title, description, schema, settings`.
4. On success, remove the local index entry (keep the blob under
   `claimed:` for 24h as a safety net), redirect to
   `/survey/<id>/edit?autopublish=1&count=<n>&gen=<0|1>`.
5. On failure, surface the error with a retry button.

### Editor autopublish handoff

`survey-editor.tsx` reads the `autopublish` search param once on mount:
- Opens the Publish dialog with initialTab='publish'.
- Seeds the dialog's `count` and `generateResponses` from the URL.
- `router.replace` to strip the params so refresh doesn't re-fire.
- Adds a new optional `autoFire` prop to `PublishDialog` that, once
  the dialog is open AND all initial conditions satisfy (answerable
  count > 0), fires `handlePublish` once.

### Proxy

Add `/claim-draft` to `PROTECTED_PREFIXES` in `src/proxy.ts`. Anon
hits get bounced to `/login?next=/claim-draft`, which matches the
stash's redirect.

## Data / session

Client-side session via `src/lib/supabase/client.ts` (already exists).
A thin `src/hooks/use-session.ts` exposes `{ session, isLoading }`
backed by `supabase.auth.getSession()` + `onAuthStateChange`. Used by
the publish dialog and could be reused by the editor header later.

## Edge cases & failure modes

| Case | Behavior |
|---|---|
| Email template lacks `{{ .Token }}` | verifyOtp accepts the 6-digit code that the default Supabase template already includes; doc note in SETUP.md if a project overrode the template |
| Supabase OTP rate limit (~60s) | Step 2 surfaces the Supabase error text verbatim; "Resend" button disabled for 30s after last send |
| User closes tab mid-OTP | pending-publish stays for 24h; returning to `/test/edit` and hitting Publish again takes the same path |
| User logs in with a different email | New account gets the draft; intentional, matches user choice |
| Account deleted mid-flow | POST /api/surveys 401s → claim page shows error with "Start new draft" link to `/test/edit` |
| Two tabs claim at once | Second tab finds empty pending-publish → `router.replace('/test')` |
| User lands on `/test/edit` with corrupted id | Existing "Survey not found" branch remains; they can start a new draft |
| `/api/surveys` payload exceeds limit | Unlikely (localStorage caps draft size ~5 MB, server route has no stricter cap); fails loudly with error surfaced on claim page |

## Test plan

**Unit:**
- `pending-publish.test.ts`: stash→has→consume lifecycle, TTL,
  consume-twice returns null, clears under `claimed:` key.
- `login-otp.test.tsx`: step machine (email → code), resend cooldown,
  error surfacing. Mocks `createClient` from `@/lib/supabase/client`.
- `claim-draft.test.tsx` (optional): happy path + missing-payload +
  401 branches.

**Manual smoke (after commits land):**
1. Anon: landing → Start Building → `/test/edit?id=X` exists,
   localStorage populated, refresh persists.
2. Anon: Publish in `/test/edit` → redirected to `/login?next=/claim-draft`.
3. OTP path: email → code → verified → land on claim-draft → redirected
   to `/survey/<uuid>/edit?autopublish=1&...` → publish dialog fires
   and survey becomes live.
4. Google path: same as above but via OAuth.
5. Authed /dashboard → New Survey → Publish: no change vs today.

## Rollout / commit plan

Four commits, each green on `npm test` + `npm run build`, with commits
2 and 4 manually smoked:

1. **pending-publish helpers + tests** — pure data layer.
2. **passwordless /login + /signup redirect** — shippable on its own;
   password logins stop working after this lands. (Existing users
   can still sign in via email OTP; the email is their identifier.)
3. **landing CTA + auto-mint draft** — shippable on its own; pre-
   commit-4, Publish on /test still mock-publishes for unauth users.
4. **publish interception + /claim-draft + proxy + autopublish
   handoff** — the behavior the brief asks for, depends on 1–3.

## Files touched

| File | Kind |
|---|---|
| `src/app/page.tsx` | edit |
| `src/app/test/edit/page.tsx` | edit |
| `src/app/(auth)/login/page.tsx` | rewrite |
| `src/app/(auth)/signup/page.tsx` | rewrite (→ redirect) |
| `src/app/claim-draft/page.tsx` | new |
| `src/components/survey/editor/publish-dialog.tsx` | edit |
| `src/components/survey/editor/survey-editor.tsx` | edit |
| `src/lib/survey/local-surveys.ts` | edit (helpers) |
| `src/hooks/use-session.ts` | new |
| `src/proxy.ts` | edit (PROTECTED_PREFIXES) |
| `src/lib/survey/__tests__/pending-publish.test.ts` | new |
| `src/app/(auth)/login/__tests__/login-otp.test.tsx` | new |
