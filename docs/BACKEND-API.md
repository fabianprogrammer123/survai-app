# Backend API Contract

The contract every `/api/**` route in Survai exposes. Frontend can change UI freely as long as it keeps calling these shapes.

**Conventions used throughout:**
- All requests/responses are JSON unless noted.
- Errors follow a typed envelope: `{ error: string, code: 'unauthorized'|'forbidden'|'not_found'|'bad_request'|'internal', details?: unknown }` (defined in [`src/lib/api/errors.ts`](../src/lib/api/errors.ts)).
- Auth-required routes use Supabase session cookies (set automatically when the user is logged in via the browser; for server-to-server use a Bearer token).
- Anon-allowed routes work without any auth header.
- Owner-gated routes verify the authenticated user owns the resource (and Postgres RLS enforces this independently as defense-in-depth).

---

## Survey lifecycle (the M0 happy path)

### `POST /api/surveys`
**Auth:** authenticated • **Status:** verified in M0 • **File:** [`src/app/api/surveys/route.ts`](../src/app/api/surveys/route.ts)

Creates a new draft survey owned by the calling user.

**Request body** (both fields optional, schema in [`src/lib/api/schemas.ts`](../src/lib/api/schemas.ts)):
```ts
{ title?: string (1-200 chars), description?: string (max 2000) }
```

**Response (201):** the full SurveyRow:
```ts
{
  id: uuid,
  user_id: uuid,
  title: string,
  description: string | null,
  schema: unknown[],   // SurveyElement[]
  settings: object,    // SurveySettings
  published: false,
  published_at: null,
  agent_id: null,
  public_url: null,
  created_at: ISO8601,
  updated_at: ISO8601,
}
```

**Errors:** 401 unauthorized, 422 bad_request (Zod validation), 500 internal.

**Side effects:** inserts into `surveys` with `user_id = auth.uid()` (default), empty `schema`, `DEFAULT_SETTINGS` for `settings`. Logs `{ event: 'surveys.created', userId, surveyId, durationMs }`.

---

### `POST /api/surveys/[id]/publish`
**Auth:** authenticated, owner-only • **Status:** existed pre-M0, verified working • **File:** [`src/app/api/surveys/[id]/publish/route.ts`](../src/app/api/surveys/%5Bid%5D/publish/route.ts)

Marks a survey as published so it's reachable at `/s/[id]`.

**Request body** (both optional):
```ts
{ agentId?: string, publicUrl?: string }
```

`agentId` is the ElevenLabs voice-agent id (set when voice mode is enabled); `publicUrl` overrides the default `${origin}/s/${id}`.

**Response (200):**
```ts
{ surveyId: string, publicUrl: string, published: true }
```

**Errors:** 401 unauthorized, 403 forbidden (not owner), 404 not_found, 500 internal.

**Side effects:** sets `published=true`, `published_at=now()`, optionally `agent_id` and `public_url` on the surveys row.

---

### `POST /api/surveys/[id]/submit`
**Auth:** **anonymous** (no auth required) • **Status:** rewritten + verified in M0 • **File:** [`src/app/api/surveys/[id]/submit/route.ts`](../src/app/api/surveys/%5Bid%5D/submit/route.ts)

Records a respondent's answers for a published survey. Public endpoint.

**Request body:**
```ts
{ answers: Record<string, unknown>, guestToken?: string }
```

`answers` is a map keyed by element id. `guestToken` (optional) links the response to a pre-invited guest; requires `SUPABASE_SERVICE_ROLE_KEY` to be set or it's silently skipped.

**Response (200):** `{ success: true }`

**Errors:**
- 400 invalid JSON body
- 422 missing/invalid `answers` field
- 404 survey not found OR not published (RLS rejected the insert)
- 500 internal

**Side effects:** inserts into `responses` with `channel='web_form'` and a metadata blob (`userAgent`, `submittedAt`). Logs `{ event: 'response.submitted', surveyId, durationMs }` on success or `response.submit_failed` with reason on failure.

**Why no response id is returned:** anon respondents don't satisfy the SELECT-after-INSERT (RETURNING) RLS policy on `responses` (owner-only). The route deliberately omits `.select()` from the insert and returns just `{success:true}`. If you need the response id later, query as the owner.

---

## Respondent surface (HTML, not /api)

### `GET /s/[id]` — anonymous web form
**File:** [`src/app/s/[id]/page.tsx`](../src/app/s/%5Bid%5D/page.tsx)

Renders the published survey for a respondent. Loads the survey via the anon Supabase client (RLS "Public read published" policy). Returns 404 (via `notFound()`) if the survey isn't published. Optional `?t=<token>` query param renders the personalized `GuestSurvey` component for invited guests.

### `GET /s/preview/[data]` — base64 preview
**File:** [`src/app/s/preview/[data]/page.tsx`](../src/app/s/preview/%5Bdata%5D/page.tsx)

Decodes a base64-encoded survey blob from the URL. Used by the publish dialog when the survey has no Supabase id (the `/test` localStorage flow). No backend, no responses captured — pure preview.

---

## Guest invites (deferred — exists but not exercised in M0)

| Route | Method | File |
|---|---|---|
| `/api/surveys/[id]/guests` | POST (create), GET (list) | [route.ts](../src/app/api/surveys/%5Bid%5D/guests/route.ts) |
| `/api/surveys/[id]/guests/[token]` | GET | [route.ts](../src/app/api/surveys/%5Bid%5D/guests/%5Btoken%5D/route.ts) |
| `/api/surveys/[id]/guests/[token]/profile` | GET | [route.ts](../src/app/api/surveys/%5Bid%5D/guests/%5Btoken%5D/profile/route.ts) |

These power the "personalized voice survey link" feature. The schema (`public.guests` table) is provisioned. Owner-side UI to send invites does not yet exist. **Will be documented properly in M3 (voice + phone).**

---

## AI assistance (used by the editor's chat panel)

Routes under `/api/ai/*`. These proxy OpenAI / ElevenLabs calls and are owned by the editor surface, not the survey lifecycle. They're documented here for completeness but not modified in M0.

| Route | Purpose |
|---|---|
| `/api/ai/health` | Liveness check; `{ ok: true }` if `OPENAI_API_KEY` is set |
| `/api/ai/chat` | Main AI chat endpoint (non-streaming) — drives survey generation + commands |
| `/api/ai/chat/stream` | Streaming variant (SSE) |
| `/api/ai/chat/test` | Test-mode chat with relaxed schema |
| `/api/ai/chat/test/stream` | Streaming test variant |
| `/api/ai/responses` | Generates mock AI respondents for the publish-dialog "Generate N responses" demo |
| `/api/ai/results` | A2UI-driven results-page chat |
| `/api/ai/voice/transcribe` | OpenAI Whisper transcription for voice input |
| `/api/ai/voice/synthesize` | ElevenLabs TTS (legacy text-to-speech) |
| `/api/ai/image` | Image generation for survey backgrounds |

**Auth posture:** All currently use `OPENAI_API_KEY` from the server env. No per-user rate limiting (deferred — out of MVP scope per direction).

---

## ElevenLabs voice agent (M3 territory)

| Route | Purpose |
|---|---|
| `/api/elevenlabs/agent` | Create a Conversational AI agent for a survey |
| `/api/elevenlabs/signed-url` | Get a signed URL for the browser to start a conversation |
| `/api/elevenlabs/call` | Initiate a single outbound phone call |
| `/api/elevenlabs/batch` | Start a batch phone campaign |
| `/api/elevenlabs/tts` | TTS synthesis |

**Status:** routes exist; not exercised end-to-end yet. **Full design + verification in M3.** The publish dialog already calls `/api/elevenlabs/agent` when the user picks the voice path.

---

## Webhooks

| Route | Purpose |
|---|---|
| `/api/webhooks/elevenlabs` | Receive ElevenLabs conversation transcripts → save as a `responses` row with `channel='web_voice'` or `'phone_call'` |

**Status:** scaffolded; needs a public URL to be useful. **Will become important in M2 (deploy) and M3 (voice).**

---

## Adding a new API route — checklist

When the frontend needs a new endpoint:

1. **Decide auth posture.** Anon (public, RLS-protected)? Authenticated (any logged-in user)? Owner-only (specific resource)?
2. **Define the wire shape in [`src/lib/api/schemas.ts`](../src/lib/api/schemas.ts).** Zod schema for request body + response. Export the inferred TS type.
3. **Use [`src/lib/api/errors.ts`](../src/lib/api/errors.ts)** for error responses — keeps the typed envelope consistent.
4. **Use the `log` helper from [`src/lib/log.ts`](../src/lib/log.ts).** At minimum: `log.info({ event: 'noun.verb', ...identifiers, durationMs })` on success, `log.warn` or `log.error` on failure.
5. **For routes that write to Supabase:** use `createClient()` from [`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts) (anon + cookie session). Only use `createServiceClient()` when you genuinely need to bypass RLS (e.g. cross-user updates from a webhook).
6. **Avoid `.select()` after `.insert()` for anon routes.** RETURNING triggers SELECT policy checks that anon usually fails — even if the INSERT itself is allowed.
7. **Update this doc.** Add the new route under the right section with its auth posture, request/response shape, side effects, and error codes.
