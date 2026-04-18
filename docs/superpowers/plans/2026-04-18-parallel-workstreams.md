# Parallel Workstreams Plan — 2026-04-18

Three streams to run in parallel worktrees after the backend+frontend
harmonization landed on `main` (commit `4f68d22`, deployed to
https://sur-ways.com). Each stream has its own worktree, branch, and dev
port, owns a disjoint (or near-disjoint) set of files, and ends with a
push to its feature branch — the main thread then merges one at a time
into `main` (which auto-deploys to Cloud Run).

## Current state (what just shipped)

Production is live at https://sur-ways.com with:
- Full UI: share-dialog fix, AI-responses opt-in default, chat preview
  → editor section linking, icon-driven type-picker, voice-to-textbox.
- Backend: Docker + Cloud Run + GitHub Actions auto-deploy on `main`,
  Supabase schema + migrations, Anthropic Claude (prompt-guided JSON,
  no more grammar-too-large errors), per-route env guards, `/api/health`.
- Voice agent harmonization: ElevenLabs agent-builder + webhook now
  cover all 17 element types (NPS, Slider, Matrix Single/Multi, Likert,
  Ranking, Image Choice included).

## What the user asked for

1. **Agent transparency + fine-tuning** — see what the chat agent is
   thinking at each step, see tool calls / reasoning, then fine-tune
   the agent to produce surveys in a preferred style.
2. **Voice-answering on shareable link** — respondents who click a
   shared `/s/:id` link can answer by voice in the browser. *Phone
   calls are out of scope for now.*
3. **Security foundations** — audit and harden before real users see
   the site.

## Things the user didn't mention but should know

In order of urgency:

1. **Secrets are NOT leaked in the repo.** `.env*` is in `.gitignore`;
   only `.env.example` + `.env.production.example` are tracked.
   Production secrets (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
   `ELEVENLABS_API_KEY`) are in Google Secret Manager, referenced via
   `--set-secrets` in `.github/workflows/deploy.yml`. Fabian worried
   about API keys but that specific concern is handled. The real
   security gaps are RLS + auth + HMAC + rate limiting.

2. **Two editors exist.** `/test/edit` (anon demo, localStorage) and
   `/survey/[id]/edit` (authenticated, autosaves to Supabase via
   `useAutoSave`). They use mostly-shared components but diverge at the
   top-level wrapper (`EditorHeader + ChatPanel` vs `EditorToolbar +
   BlockPalette + RightPanel`). This fork will drift. Consolidating
   them is a worthwhile future stream but not urgent.

3. **Open bug: `undefined` elements during AI streaming.** Symptom
   hotfixed; root cause untraced. Stream A will be inspecting the
   streaming path closely anyway — a good opportunity to fix it.

4. **No unit tests.** Only Playwright visual smokes. Before any stream
   refactors the AI store mutations or chat routes, minimal regression
   tests on `src/lib/survey/store.ts` and the chat route's JSON parse
   path would prevent a regression slipping through. Stream A picks
   this up naturally; the others can skip it.

5. **Anon `/test` flow has no autosave.** Users building a demo survey
   lose work on refresh. Low priority — `/test` is explicitly a
   "try before signup" surface — but worth noting.

6. **Zero production observability.** No Sentry/Datadog. The only log
   stream is Cloud Run's default stdout capture. Real errors in prod
   won't page anyone. Stream C touches this adjacent area and should
   at minimum add a structured error logger.

7. **Data retention / GDPR.** If respondents' voice transcripts and
   answers are collected from EU users, there's a data retention
   policy obligation. Not in scope now; flag for future work.

---

# The three streams

## Stream A — Agent transparency + fine-tuning

**Goal.** Creator can see exactly what the AI chat agent is doing: which
model was called, how the system prompt looked, what intent it
classified, what its per-proposal rationale was, how long each step
took, how many tokens it used, and any commands it ran. Then provide
knobs to fine-tune the agent's output style per-survey.

**Why this bundle.** Visibility and fine-tuning are the same feature
from two angles: you can only tune what you can see. Delivering them
together avoids a rebuild.

**Scope — in.**
- New `ai_traces` table (migration) holding per-turn trace rows.
- Trace capture in `/api/ai/chat*` routes: write a trace row with
  `survey_id`, `turn_index`, `model`, `system_prompt_hash` + first
  500 chars, `user_message`, `intent`, `duration_ms`, `input_tokens`,
  `output_tokens`, `raw_response_sample` (first 2k chars), `commands`,
  `proposals_count`, `error`.
- "AI Inspector" right-drawer or slide-over in the chat panel:
  per-message expansion showing the trace. Starts behind an
  `?inspector=1` query param (dev mode) then graduates to a button
  once polished.
- Per-survey fine-tune controls in survey settings / AI Context:
  - Model selection (Opus 4.7 vs Sonnet 4.6 vs Haiku 4.5)
  - Temperature slider (0.0–1.0, default 0.3)
  - System prompt override (textarea; when non-empty, appended to
    the base prompt instead of replacing it)
  - "Style examples" — a free-text field the creator can fill with
    "keep questions under 10 words, no jargon, always include a
    'prefer not to answer' option" etc. — fed verbatim into the
    system prompt as a `Style guidance` section.
- Root-cause fix for `undefined in survey.elements`: since Stream A is
  adding instrumentation around the streaming path, fix at source
  (guard `hydrateBlueprint` output to be non-sparse, validate
  `proposal.elements` before the for-of loop in `handleProposalSelect`
  in `chat-panel.tsx`). Remove the scattered `el && ...` guards.
- Minimal Vitest unit tests: store mutations (`addElement`,
  `replaceElements`, `sanitizeElements`), chat route JSON parse +
  zod-validation fallback, trace capture write path. These don't need
  to be exhaustive — just a regression floor for Stream A's domain.

**Scope — out.**
- Nothing on `/s/*` (respondent side).
- Nothing under `src/components/survey/response/`.
- Don't touch Supabase RLS on existing tables.
- Don't touch `/api/elevenlabs/*`.
- Don't touch `src/proxy.ts`.

**Files owned exclusively.**
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/chat/test/route.ts`
- `src/app/api/ai/chat/test/stream/route.ts`
- `src/app/api/ai/results/route.ts` (if adding trace there too)
- `src/lib/ai/*`
- `src/components/survey/chat/*`
- `src/lib/survey/store.ts` (store mutation tests)
- `src/components/survey/editor/properties-panel.tsx` (adding the
  fine-tune controls in AI Context section)
- New: `supabase/migrations/20260419000000_ai_traces.sql`
- New: `src/components/survey/chat/ai-inspector-drawer.tsx`
- New: `vitest.config.ts` + `src/**/__tests__/*.test.ts`

**Done criteria.**
- On `/test/edit`, send "Create a simple feedback survey" and see a
  matching trace row in the new AI Inspector panel showing model
  name, intent=generate, duration, token count, proposal rationales.
- Change the model to Sonnet 4.6 in survey AI Context, resend, see
  the trace reflect the switch.
- Add "Questions must be under 10 words" in Style guidance, resend,
  see shorter questions in the proposed elements.
- Vitest tests run green: `npm test`.
- No `el && ...` hotfix guards remain in the codebase.

---

## Stream B — Voice-answering on shareable link

**Goal.** A respondent opens a shared `/s/:id` link in a browser,
chooses "Answer by voice", has a natural web-audio conversation with
the ElevenLabs agent, sees a read-back of their answers, confirms and
submits. Phone calls are out of scope.

**Why this bundle.** The web voice path is already wired end-to-end
but buried behind creator-only publish flow. Unblocking respondent-side
adoption is the single biggest voice-product win.

**Scope — in.**
- `/s/:id` landing: redesign to present "Answer by voice" and
  "Answer by typing" as two equal-weight choices (or voice-primary
  with typing as a secondary option, if that matches current design
  intent from the guest flow).
- Wire the ElevenLabs web voice session using the `@elevenlabs/react`
  SDK (already a dep). Browser mic + streaming audio playback.
- In-call UI: live transcript (agent and respondent), live question
  progress indicator (e.g., "3 of 8"), option to switch to typing
  without losing progress.
- **Read-back before submit.** When the agent ends the conversation,
  show a summary screen: one row per question with the captured
  answer, each editable. Respondent confirms and clicks Submit.
- Submission verification: after clicking submit, poll
  `/api/webhooks/elevenlabs?conversationId=X` (or equivalent) to
  confirm the response row was written. Show a visible success
  state only after confirmation. Timeout with actionable retry.
- Mobile: 375px viewport must work — voice button + transcript
  visible, no horizontal scroll.
- Edge cases: mic permission denied → graceful fallback to text;
  network drop mid-conversation → resume button or escalate to
  text; browser audio autoplay blocked → manual "start" button.

**Scope — out.**
- No phone dialing (batch API or outbound calls).
- No creator-side changes — don't modify `/test/edit`, `/survey/*/edit`,
  the publish dialog, or the editor components beyond what a shared
  helper move requires.
- No AI chat changes (Stream A's domain).
- No auth or RLS changes (Stream C's domain).

**Files owned exclusively.**
- `src/app/s/[id]/page.tsx`
- `src/app/s/preview/[data]/page.tsx` (if matching the new landing)
- `src/components/survey/response/*` (guest-survey, survey-form)
- `src/components/survey/voice-interview.tsx`
- `src/hooks/use-voice-input.ts`, `src/hooks/use-voice-output.ts` (if
  reusing for respondent side)
- `src/app/api/surveys/[id]/submit/route.ts` (if read-back changes
  the submit shape — coordinate briefly with Stream C if so)
- Possibly new: `src/components/survey/response/voice-session.tsx`,
  `src/components/survey/response/answer-readback.tsx`.

**Done criteria.**
- On a fresh mobile browser, open a published survey link, tap
  "Answer by voice", complete a 5-question survey, see read-back,
  confirm, see confirmed persistence.
- Same on desktop.
- Mic permission denied → clean text fallback.
- Network drop mid-call → clear error state, respondent can retry.
- Webhook race: if respondent clicks submit before webhook arrives,
  they see a "processing…" state that resolves to success within 10s
  or surfaces an actionable error.

---

## Stream C — Security foundations

**Goal.** Close the security gaps that would disqualify this from real
user traffic. Focus on the four concrete issues from the architecture
audit (RLS, auth on cost routes, HMAC, idempotency) plus light
observability so we can see failures in production.

**Why this bundle.** All four are server-side, route-level, or
Supabase-level — tight focus, clear acceptance criteria, low
coordination cost. Also grabs observability since it's adjacent.

**Scope — in.**
- **RLS migration** for `guests`: replace `select using (true)` with a
  policy that requires the request include the guest's token (via a
  header claim or a security-definer function). Owner full access
  preserved.
- **Auth helpers** (`src/lib/api/require-auth.ts`): small reusable
  `requireAuth(req): Promise<{ user } | Response>` — returns a `401`
  Response if no session, else the user.
- **Auth-gate cost-engine routes**: `/api/ai/responses`,
  `/api/elevenlabs/agent`, `/api/elevenlabs/batch` — call `requireAuth`
  at the top, return 401 for anon. The `/api/ai/chat/test*` routes
  stay anon (that's the /test demo surface).
- **HMAC signature verification** on `/api/webhooks/elevenlabs`: verify
  the signature header using `ELEVENLABS_WEBHOOK_SECRET` (add to env
  + Secret Manager). Reject malformed.
- **Idempotency** on webhook POST: add unique constraint on
  `responses(metadata->>conversationId)` (or a dedicated column) and
  switch the insert to an upsert, or check-then-insert.
- **Rate limiting**: per-IP + per-route sliding window, in-memory LRU
  (acceptable for single-instance Cloud Run with `min-instances 0`).
  100 req / hour / IP for anon routes; 1000 for authed; expensive AI
  routes much tighter (10/hour/user for `/api/ai/responses`).
- **Structured logger** (`src/lib/log.ts` exists — extend it): emit
  JSON lines with `event`, `userId`, `surveyId`, `durationMs`,
  `error.message`, `error.code`. Cloud Run captures stdout; these
  become queryable in Cloud Logging.
- **SECURITY.md runbook**: env setup, secret rotation steps, "what to
  do when X leaks", contact path.

**Scope — out.**
- Don't touch AI chat logic, prompts, or chat UI (Stream A).
- Don't touch respondent voice UX (Stream B).
- Don't modify editor components.
- Don't start full Sentry integration — structured logs are enough
  for this pass.

**Files owned exclusively.**
- `src/proxy.ts` (rate limit middleware)
- `src/lib/log.ts` (extend)
- `src/lib/api/*` (auth + rate-limit helpers)
- `supabase/migrations/20260419000100_rls_guests_token.sql`
- `supabase/migrations/20260419000200_responses_idempotency.sql`
- `/api/ai/responses/route.ts`, `/api/ai/image/route.ts` (auth wrap)
- `/api/elevenlabs/agent/*`, `/api/elevenlabs/batch/*` (auth wrap)
- `/api/webhooks/elevenlabs/route.ts` (HMAC + idempotency)
- New: `SECURITY.md`
- `.env.example` + `.env.production.example` (add
  `ELEVENLABS_WEBHOOK_SECRET`)

**Done criteria.**
- `curl -s -X POST https://sur-ways.com/api/ai/responses -d '...'` → 401.
- `curl -s https://sur-ways.com/api/surveys/$ID/guests/$TOKEN` → 401 or
  row for that token only (cannot enumerate other tokens).
- Forged webhook (wrong signature) → 401.
- Sending the same webhook twice → single row.
- Hammering any anon route 100x → 429 after threshold.
- Cloud Logging shows structured JSON lines for every API call.
- `SECURITY.md` exists with a clear rotation runbook.

---

# Worktree setup

```bash
# From the main repo directory
cd /Users/fabian/Desktop/Coding_projects/survai

# Make sure everything is clean on main first
git fetch --all
git checkout main
git pull --ff-only origin main

# Stream A
git worktree add -b feat/agent-transparency .worktrees/agent-transparency main

# Stream B
git worktree add -b feat/voice-shareable-link .worktrees/voice-link main

# Stream C
git worktree add -b feat/security-foundations .worktrees/security main

# Copy .env.local into each worktree so dev servers can run
for d in agent-transparency voice-link security; do
  cp .env.local ".worktrees/$d/.env.local"
done
```

**Port allocation** (so three dev servers can run simultaneously):
- Stream A: `PORT=3010 npx next dev --port 3010`
- Stream B: `PORT=3011 npx next dev --port 3011`
- Stream C: `PORT=3012 npx next dev --port 3012`

---

# Agent prompts

Each prompt is self-contained. Paste the relevant one into a fresh
agent session. The agent writes code, commits, and pushes its branch —
but does **not** merge to main. The main thread (us) coordinates
merges one stream at a time.

## Prompt: Stream A — Agent Transparency + Fine-Tuning

> You are implementing **agent transparency + fine-tuning** for the
> survai project at
> `/Users/fabian/Desktop/Coding_projects/survai/.worktrees/agent-transparency`.
> Check out branch `feat/agent-transparency` — it was just created from
> `main` at commit `4f68d22`. Work exclusively inside this worktree.
>
> Before coding, read
> `docs/superpowers/plans/2026-04-18-parallel-workstreams.md` for the
> full scope — including files you must NOT touch because two sibling
> streams (`feat/voice-shareable-link` and `feat/security-foundations`)
> are working in parallel and conflicts need to be avoided.
>
> **Deliverables (in order):**
>
> 1. Minimal Vitest setup (`vitest.config.ts`, `npm test` script).
>    Write 4–6 regression tests covering store mutations
>    (`src/lib/survey/store.ts`) and the chat route's JSON parse +
>    zod fallback path. Lock in current behavior.
>
> 2. Fix the `undefined in survey.elements` bug **at source**, not
>    symptom. Root cause is almost certainly in the streaming path:
>    either `proposal.elements` arriving sparse, or `hydrateBlueprint`
>    emitting nullish entries. Audit
>    `src/components/survey/chat/chat-panel.tsx` `handleProposalSelect`
>    and `src/lib/templates/hydrate.ts`. Add a guard at the earliest
>    point, remove the scattered `el && ...` filters elsewhere, and
>    add a Vitest regression that exercises a malformed input.
>
> 3. New `ai_traces` table. Schema: id (uuid), survey_id (uuid, fk,
>    nullable for /test flow), created_at, turn_index (int),
>    user_message (text), intent (enum: generate/propose/command/
>    clarify/error), model (text), system_prompt_hash (text),
>    system_prompt_head (text, first 500 chars), duration_ms (int),
>    input_tokens (int), output_tokens (int), proposals_count (int),
>    commands (jsonb), raw_response_sample (text, first 2k chars),
>    error (text). RLS: owner reads their own surveys' traces; anon
>    can INSERT (for /test flow, set survey_id to null). Write the
>    migration in `supabase/migrations/20260419000000_ai_traces.sql`
>    and run it against the linked Supabase project via the supabase
>    MCP tool if available; otherwise provide the user the SQL to
>    apply.
>
> 4. Trace capture in all three chat routes. Wrap the existing
>    Claude call, time it, capture model + usage + intent + error.
>    Persist a trace row. Return the `trace_id` in the API response
>    so the client can fetch or render it.
>
> 5. "AI Inspector" side-drawer component
>    (`src/components/survey/chat/ai-inspector-drawer.tsx`). Each
>    assistant message in the chat gets a small "i" icon; clicking
>    opens the drawer with the full trace: duration timeline
>    (understand → generate → hydrate), model + tokens, system
>    prompt (with a "copy" button), intent classification,
>    per-proposal rationale, raw JSON sample. Mobile-friendly.
>    Dev-mode by default behind `?inspector=1`; add a small kebab
>    menu entry to toggle it on.
>
> 6. Per-survey fine-tune controls. Extend the AI Context section in
>    `src/components/survey/editor/properties-panel.tsx` (you'll see
>    an existing goal + strictness UI). Add:
>    - Model picker (Opus 4.7, Sonnet 4.6, Haiku 4.5)
>    - Temperature slider (0.0–1.0, default 0.3)
>    - System prompt override (textarea, optional)
>    - Style guidance (free text; becomes a `## Style guidance`
>      section appended to the system prompt)
>    Persist in `survey.settings.aiContext` (already nullable in the
>    schema); thread through `buildSystemPrompt` in
>    `src/lib/ai/prompts.ts` and the route handlers.
>
> **Do not touch:**
> - `src/app/s/*`, `src/components/survey/response/*` (Stream B)
> - `src/proxy.ts`, `src/lib/api/*` auth helpers (Stream C)
> - `/api/elevenlabs/*`, `/api/webhooks/*` (Stream B/C)
> - `src/lib/elevenlabs/*` (Streams B/C)
>
> **Workflow:**
> - Run dev on `PORT=3010 npx next dev --port 3010`.
> - Use headless Chromium for verification (we already use playwright
>   — see `scripts/smoke-integration.mjs` as a reference pattern).
> - Commit in logical chunks (vitest setup, undefined fix, traces
>   migration, trace capture, inspector drawer, fine-tune controls).
> - When done, push the branch: `git push -u origin feat/agent-transparency`.
> - Do NOT merge to main. Report back when your branch is ready for
>   review.
>
> **Report format on completion:**
> - Branch + HEAD SHA
> - Summary of what's in each commit
> - Screenshot or DOM snapshot of the AI Inspector drawer
> - Vitest test count + pass/fail summary
> - Anything you had to skip or found in scope that needs a follow-up
>
> Work carefully. Production-grade code. If anything in the plan is
> ambiguous, make a documented judgment call and flag it in your
> report rather than blocking.

## Prompt: Stream B — Voice-Answering Shareable Link

> You are implementing **voice-answering for shareable survey links**
> at
> `/Users/fabian/Desktop/Coding_projects/survai/.worktrees/voice-link`.
> Branch: `feat/voice-shareable-link`, created from `main@4f68d22`.
>
> Read `docs/superpowers/plans/2026-04-18-parallel-workstreams.md`
> first — it lists files you must NOT touch because two sibling
> streams run in parallel.
>
> **Goal.** A respondent opens `/s/:id` in a browser, picks "Answer by
> voice", has a natural voice conversation via ElevenLabs web SDK,
> reviews a read-back of their answers, confirms, and sees verified
> persistence. Mobile must work at 375px. Phone calls are out of
> scope.
>
> **Deliverables:**
>
> 1. Redesign `src/app/s/[id]/page.tsx` landing. Two equal-weight
>    CTAs: "Answer by voice" and "Answer by typing". Respect the
>    existing guest-token flow (`?t=` in URL → guest-specific).
>    Show survey title, question count, estimated time. Mobile-first.
>
> 2. Voice session wiring. Use `@elevenlabs/react` (already in deps)
>    to start a web voice session when the respondent picks voice.
>    Handle: mic permission denied, network drop, browser autoplay
>    block. Show a live transcript (agent + respondent turns). Show
>    progress ("Question 3 of 8").
>
> 3. Switch-to-text mid-conversation: single button that ends voice
>    gracefully, carries over any captured answers, lands in the
>    text form at the next unanswered question.
>
> 4. **Read-back screen.** When voice ends (respondent clicks Done or
>    agent closes), show a summary: one row per question with the
>    captured answer. Each answer is editable (convert to the right
>    input — text, choice, slider, etc., same components as
>    `src/components/survey/response/survey-form.tsx`). Respondent
>    reviews, edits any mistakes, clicks **Submit**.
>
> 5. Submit flow. On Submit, POST to `/api/surveys/[id]/submit` (the
>    existing endpoint — add a new field `channel: 'web_voice'` if
>    it's not already recorded). Show a "Processing…" state until
>    the row is confirmed persisted (query
>    `/api/webhooks/elevenlabs?conversationId=X` or the submit
>    response, whichever indicates persistence). Success screen on
>    confirm; actionable retry on timeout.
>
> 6. Mobile-responsive at 375px: voice button stays tappable, live
>    transcript scrolls, read-back screen fits.
>
> 7. Edge cases (each surface a clear UI):
>    - Mic permission denied → "We need mic access. Here's how, or
>      switch to typing."
>    - Agent disconnects unexpectedly → "The call dropped. Start
>      again or switch to typing — your answers so far are saved."
>    - Audio autoplay blocked → manual "Start speaking" button.
>
> **Files you own:**
> - `src/app/s/[id]/page.tsx`
> - `src/app/s/preview/[data]/page.tsx` (if landing redesign applies
>   to preview too)
> - `src/components/survey/response/*`
> - `src/components/survey/voice-interview.tsx` (if used here)
> - `src/hooks/use-voice-input.ts`, `src/hooks/use-voice-output.ts`
>   (only if needed)
> - Possibly new: `src/components/survey/response/voice-session.tsx`,
>   `answer-readback.tsx`
>
> **Do not touch:**
> - Anything under `src/app/test/*`, `src/app/survey/[id]/edit/*`
> - `src/components/survey/editor/*`, `src/components/survey/chat/*`
> - `src/lib/ai/*`, `src/app/api/ai/*`
> - `src/proxy.ts`, `src/lib/api/*`
> - `src/lib/elevenlabs/agent-builder.ts` (contract with Stream A/C)
>
> **Workflow:**
> - Run dev on `PORT=3011 npx next dev --port 3011`.
> - Publish a test survey from the authenticated flow
>   (`/login` → dashboard → New survey → add a mix of element types
>   → Publish) to get a real `/s/:id` link to work against.
> - Commit in logical chunks.
> - When done, push: `git push -u origin feat/voice-shareable-link`.
> - Do NOT merge to main.
>
> **Report format on completion:**
> - Branch + HEAD SHA
> - Per-commit summary
> - Screenshots: desktop landing, mobile landing, in-call, read-back
> - One recorded or verbally-reported end-to-end test on a real
>   published survey
> - Any edge cases you hit that surprised you
>
> Work carefully. Voice UX is easy to ship half-broken — test the
> unhappy paths (mic denied, mid-call drop, autoplay block) explicitly.

## Prompt: Stream C — Security Foundations

> You are implementing **security foundations** for the survai project
> at
> `/Users/fabian/Desktop/Coding_projects/survai/.worktrees/security`.
> Branch: `feat/security-foundations`, created from `main@4f68d22`.
>
> Read `docs/superpowers/plans/2026-04-18-parallel-workstreams.md`
> first — it lists files you must NOT touch because two sibling
> streams run in parallel.
>
> **Context (important):** Secrets are NOT leaked in the repo — `.env*`
> is gitignored; production secrets live in Google Secret Manager and
> are referenced via `--set-secrets` in
> `.github/workflows/deploy.yml`. The real gaps are: RLS on the
> `guests` table uses `select using (true)` (effectively public);
> cost-engine routes (`/api/ai/responses`, `/api/elevenlabs/*`) have
> no auth; the ElevenLabs webhook has no HMAC signature verification;
> no idempotency on webhook inserts; no rate limiting. Also: zero
> structured logging to Cloud Logging — we can't observe failures.
>
> **Deliverables:**
>
> 1. `src/lib/api/require-auth.ts`: a reusable
>    `requireAuth(req: NextRequest): Promise<{ user } | Response>`.
>    Returns a 401 JSON response if no session. Used across routes so
>    Streams A and B can adopt it without touching your code.
>
> 2. Auth-gate these routes (call `requireAuth` at the top):
>    - `src/app/api/ai/responses/route.ts`
>    - `src/app/api/ai/image/route.ts`
>    - `src/app/api/elevenlabs/agent/**/*.ts`
>    - `src/app/api/elevenlabs/batch/**/*.ts`
>    Keep `/api/ai/chat/test/**` anon (those are the /test demo).
>
> 3. RLS fix for `guests`. New migration:
>    `supabase/migrations/20260419000100_rls_guests_token.sql`.
>    Replace `Public read by token` policy with a security-definer
>    function that checks a passed token. Owner access preserved.
>    The anon read path goes through a `/api/surveys/[id]/guests/[token]`
>    route that validates the token server-side using the service
>    role client. Update that route if needed.
>
> 4. HMAC verification on `/api/webhooks/elevenlabs/route.ts`. ElevenLabs
>    sends an `elevenlabs-signature` header. Add
>    `ELEVENLABS_WEBHOOK_SECRET` to `.env.example`,
>    `.env.production.example`, and the GH Actions workflow's
>    `--set-secrets`. Verify with `crypto.timingSafeEqual` — reject
>    401 on mismatch.
>
> 5. Idempotency on webhook POST. New migration:
>    `supabase/migrations/20260419000200_responses_idempotency.sql`.
>    Add unique index on `responses` keyed by
>    `metadata->>'conversationId'` (partial, where conversationId is
>    not null). Switch the webhook's insert to an upsert (or
>    `insert … on conflict do nothing`). Add a regression that posts
>    the same webhook twice and asserts one row.
>
> 6. Rate limiting. Implement an in-memory sliding-window LRU in
>    `src/lib/api/rate-limit.ts`. Per-IP + per-route. Defaults:
>    - Anon routes: 100 req / hour / IP
>    - Authed non-AI routes: 1000 req / hour / user
>    - `/api/ai/responses`: 10 req / hour / user
>    - `/api/elevenlabs/batch`: 5 req / hour / user
>    Integrate in `src/proxy.ts`. 429 on exceed. Acceptable caveat
>    for Cloud Run min-instances=0: rate limits reset on cold start.
>    Note this in a comment + SECURITY.md.
>
> 7. Structured logger. Extend `src/lib/log.ts` so every log line is
>    JSON with stable keys: `ts`, `level`, `event`, `userId?`,
>    `surveyId?`, `durationMs?`, `error.message?`, `error.code?`.
>    Standardize on `log.info({ event: 'x.y', ...rest })`. Replace
>    loose `console.error` calls in API routes with
>    `log.error({ event, ... })`.
>
> 8. `SECURITY.md` in the repo root. Runbook:
>    - Env handling (where secrets live, how to rotate each)
>    - "What to do when X leaks" (revoke, deploy, rotate downstream)
>    - Threat model summary (who can call what, with what auth)
>    - On-call / contact path
>
> **Do not touch:**
> - `src/components/*` except `survey/editor/properties-panel.tsx`
>   — and only if you need to add an "admin/security" panel, which
>   is out of scope for this stream
> - `src/lib/ai/*`, `src/app/api/ai/chat/**` (Stream A)
> - `src/app/s/*`, `src/components/survey/response/*` (Stream B)
> - `src/lib/elevenlabs/agent-builder.ts` internals (Stream A/B
>   coordination)
>
> **Workflow:**
> - Run dev on `PORT=3012 npx next dev --port 3012`.
> - Apply migrations via supabase MCP tool if available; otherwise
>   export the SQL and commit it for the user to apply.
> - Verify each deliverable with a curl/fetch test — document the
>   exact command + output in your report.
> - Commit in logical chunks.
> - Push: `git push -u origin feat/security-foundations`.
> - Do NOT merge to main.
>
> **Report format on completion:**
> - Branch + HEAD SHA
> - Per-commit summary
> - Curl transcript: 401 on unauthed cost route, forged webhook
>   rejected, idempotent double-post, rate-limit 429 after threshold
> - List of env vars added (user will add to Secret Manager)
> - SECURITY.md contents preview
>
> Work carefully. Any migration that's wrong gets rolled back, and
> rolling back RLS is loud. Preview each migration against the live
> Supabase project before committing if you can.

---

# Merge strategy

Each stream pushes its branch to origin. **Do not merge to main in
the worker sessions.** Back in the main thread (this session or a
future one) I will:

1. Fetch all three branches.
2. Test each locally (`next build` + smoke script).
3. Merge **Stream C first** (foundational, additive), verify on
   Cloud Run smoke.
4. Merge **Stream A second** (creator-facing). Rebase on top of C
   (should be near-conflict-free since owned files are disjoint).
5. Merge **Stream B third** (respondent-facing). Rebase on top of
   A+C.
6. Each merge → push main → auto-deploys.

If any stream finishes early, the others continue independently —
they rebase on main after each merge, which adds at most a few
minutes of conflict resolution per rebase.

**Conflict forecast** (from file-ownership analysis):
- A + B: truly disjoint. Zero expected conflicts.
- A + C: both touch `/api/ai/responses` (C adds auth wrap, A adds
  trace capture). Expected: 2–3 line merge in the route. Trivial.
- B + C: both could touch `/api/surveys/[id]/submit` if B needs to
  persist `channel: 'web_voice'` and C adds rate limiting. 1–2
  line merge. Trivial.

---

# Context management for this session

I've just finished planning. To avoid holding all three streams in
context:

- This plan doc is the durable hand-off. Spawning the three agents is
  a cheap operation in a fresh session; the context needed is already
  captured in the three prompts above.
- I'll flush my working memory by ending this session here unless the
  user wants me to spawn the agents right now.
- If we spawn agents now, I'd only hold their final reports (not their
  full transcripts), and merge one at a time.

**Recommendation:** close this session, open a fresh one, paste one
prompt per sub-session (or spawn via the Agent tool in a fresh main
thread). Each worker completes independently; come back to a main
thread for merges.
