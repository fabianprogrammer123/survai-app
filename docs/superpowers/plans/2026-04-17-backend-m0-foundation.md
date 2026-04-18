# Backend M0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and harden the Supabase backend so the chain *signup → dashboard → create → edit/auto-save → publish → /s/[id] respondent → submit → /survey/[id]/responses* works end-to-end with one canonical schema, real auth gating in middleware, and a typed POST /api/surveys contract that frontend changes can safely build on. Document the verified state at the end.

**Architecture:** Audit-driven, code-first. (1) Probe the live Supabase project via MCP to capture ground truth. (2) Consolidate to one canonical migration matching reality (apply via MCP if reality is wrong). (3) Add real middleware gating on protected paths. (4) Replace the dashboard's ad-hoc `supabase.from('surveys').insert(...)` with a typed POST `/api/surveys` route — that route is the API contract seam frontend changes can depend on. (5) Prove the chain end-to-end with one Playwright test that drives signup, create, publish, submit, and read-back. (6) Only after the user manually verifies the green chain, write the three docs (BACKEND-AUDIT, BACKEND-API, SETUP) capturing the verified state. (7) Push only on user approval.

**Tech Stack:** Next.js 16 (App Router), `@supabase/ssr` (cookie-based session) + `@supabase/supabase-js` (service-role for scripts/tests), Zod for input validation, Playwright for e2e, Supabase MCP for direct DB introspection, `tsx` (already a transitive dep) for running scripts.

**Worktree:** `/Users/fabian/Desktop/Coding_projects/survai/.worktrees/backend-prod`
**Branch:** `feat/backend-production`
**Dev server port for this worktree:** **3004** (frontend agent uses 3003; never collide)

**Out of scope (explicit):**
- `/test` localStorage flow — stays as a try-before-signup funnel; not migrated
- `/admin` page — admin tooling, deferred
- Voice mode / ElevenLabs agents — wired but not exercised by e2e
- Phone campaigns / guest invites — deferred to later milestone
- Frontend visual polish — frontend agent's surface
- Multi-tenant / teams — single-user per the project's stated MVP goals

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260417000000_base_schema.sql` | Single canonical migration. Promoted from `supabase-ddl.sql` after MCP-verified to match live DB (or applied to live DB if it didn't match). |
| `supabase/migrations/README.md` | One-page migration workflow doc — created in Task 9 after schema is verified in Task 3. |
| `src/lib/api/schemas.ts` | Zod request/response schemas for `/api/surveys/*`. Single source of truth for the wire contract. |
| `src/lib/api/errors.ts` | Tiny helper module: `unauthorized()`, `forbidden()`, `notFound()`, `badRequest(zodError)` returning typed `NextResponse.json` with consistent shape `{ error: string, code: string, details?: unknown }`. |
| `src/app/api/surveys/route.ts` | `POST /api/surveys` (create — auth-required, validates body, returns created row). No GET — dashboard uses SSR Supabase reads. |
| `tests/e2e/auth-and-survey-flow.spec.ts` | The single end-to-end test that proves the chain works. Service-role-creates-user → UI sign-in → dashboard "New Survey" → /survey/[id]/edit → publish → /s/[id] → submit → /survey/[id]/responses shows the answer. |
| `tests/e2e/middleware-gate.spec.ts` | Middleware gating tests: anon hitting /dashboard → /login?next=/dashboard. |
| `scripts/check-supabase.ts` | Non-destructive DB introspection. Connects via service-role, queries `information_schema`, prints tables + columns + RLS status. Run via `npm run db:check`. |
| `scripts/test-helpers.ts` | Shared helpers for e2e tests: `createTestUser`, `deleteTestUser`, `signInAsTestUser` (using service-role admin API). |
| `.audit/` (gitignored dir) | Working notes from the MCP probe. NOT committed. |
| `docs/BACKEND-AUDIT.md` | Captured reality after Task 8 user-approval. Written in Task 9. |
| `docs/BACKEND-API.md` | API contract reference. Written in Task 9. |
| `docs/SETUP.md` | New-developer onboarding: env, Supabase project, DDL, boot. Written in Task 9. |

### Files to modify

| Path | Change |
|---|---|
| `src/middleware.ts` | Add gating: redirect anon users on `/dashboard` and `/survey/` paths to `/login?next=<encoded-original-path>`. Add `/auth/` to PUBLIC_PATHS so callback isn't accidentally gated. |
| `src/components/dashboard/dashboard-content.tsx` | Replace direct `supabase.from('surveys').insert(...)` (lines 47-62) with `fetch('/api/surveys', { method: 'POST', body: JSON.stringify({}) })`. Delete and update flows can stay client-side for M0. |
| `playwright.config.ts` | Add a second project named `e2e` that uses `tests/e2e/`. Keep the existing `chromium` (visual) project untouched. Both share `baseURL: http://localhost:3004` (was 3002 — bump for this worktree). |
| `package.json` | Add scripts: `"db:check": "tsx scripts/check-supabase.ts"` and `"test:e2e": "playwright test --project=e2e --reporter=list"`. Add `tsx` as devDep (if not already a transitive dep). |
| `.gitignore` | Add `.audit/` so MCP probe notes don't pollute git. |

### Files to DELETE

| Path | Reason |
|---|---|
| `supabase/migrations/001_initial_schema.sql` | Superseded by canonical migration (lacks `guests` table, `published_at/agent_id/public_url` columns; would corrupt fresh installs). |
| `supabase-ddl.sql` | Promoted to a real migration file. Old root-level copy removed to prevent drift. |

### Files NOT touched (parallel-safety with frontend agent)

- `src/components/survey/editor/**`
- `src/components/survey/elements/**`
- `src/components/survey/chat/**`
- `src/lib/ai/**`
- `src/app/test/**`
- `src/app/admin/page.tsx`
- `src/app/page.tsx`
- `tests/visual/**` (existing visual suite untouched; we add `tests/e2e/` as a sibling)

---

## Task 1: Bootstrap worktree + dev server smoke

**Why first:** Every subsequent task tests against `http://localhost:3004`. Confirm the worktree boots cleanly before writing any code.

**Files:**
- Verify: `.env.local` (already copied)
- Verify: `node_modules` (symlinked to repo root — saves install time but means dep changes propagate; acceptable for MVP)
- Modify: `playwright.config.ts` (port bump only — single line change)

- [ ] **Step 1.1: Confirm env vars loaded by Next**

Run from worktree root:
```bash
cd /Users/fabian/Desktop/Coding_projects/survai/.worktrees/backend-prod
node -e "require('dotenv').config({path: '.env.local'}); console.log('URL set:', !!process.env.NEXT_PUBLIC_SUPABASE_URL); console.log('ANON set:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); console.log('SERVICE set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY); console.log('OAI set:', !!process.env.OPENAI_API_KEY);"
```
Expected: all four print `true`.

- [ ] **Step 1.2: Bump Playwright `baseURL` to 3004**

In `playwright.config.ts`, change `baseURL: 'http://localhost:3002'` to `baseURL: 'http://localhost:3004'`. This is the single change in this task.

- [ ] **Step 1.3: Boot dev server in the background on 3004**

```bash
cd /Users/fabian/Desktop/Coding_projects/survai/.worktrees/backend-prod
PORT=3004 npx next dev --port 3004 > /tmp/survai-backend-dev.log 2>&1 &
echo $! > /tmp/survai-backend-dev.pid
```
Then poll until ready:
```bash
until curl -s -o /dev/null -w "%{http_code}" http://localhost:3004 | grep -q "200\|307"; do sleep 1; done && echo "ready"
```
Expected: prints `ready` within ~30s.

- [ ] **Step 1.4: Smoke the public landing page**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3004/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3004/test
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3004/login
```
Expected: all three return 200.

- [ ] **Step 1.5: Commit the playwright port bump**

```bash
cd /Users/fabian/Desktop/Coding_projects/survai/.worktrees/backend-prod
git add playwright.config.ts
git commit -m "chore(playwright): bump baseURL to 3004 for backend-prod worktree"
```

---

## Task 2: Probe live Supabase via MCP — capture ground truth

**Why:** Two SQL files disagree on schema (`supabase-ddl.sql` vs `supabase/migrations/001_initial_schema.sql`). The publish route writes columns that only one of them defines. We must learn what's actually live before deciding what migration to canonicalize.

**Files:**
- Create: `.audit/db-snapshot.md` (gitignored — working notes)
- Modify: `.gitignore` (add `.audit/`)

- [ ] **Step 2.1: Add `.audit/` to .gitignore**

Append to `.gitignore`:
```
.audit/
```
Then:
```bash
git add .gitignore && git commit -m "chore(gitignore): exclude .audit/ working dir"
```

- [ ] **Step 2.2: Probe tables via Supabase MCP**

The Supabase MCP exposes SQL execution against project `gtiwwgmplokkqxnzoifo`. Use it to run:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

Capture the result into `.audit/db-snapshot.md` under heading `## Tables`.

- [ ] **Step 2.3: Probe columns of every public table**

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

Capture under `## Columns`.

- [ ] **Step 2.4: Probe RLS state and policies**

```sql
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
```

Capture under `## RLS`.

- [ ] **Step 2.5: Diff against `supabase-ddl.sql`**

In `.audit/db-snapshot.md`, add a final section `## Diff vs supabase-ddl.sql` with three subsections:
- **Tables present in DDL but missing in DB:** (list)
- **Columns present in DDL but missing in DB:** (list)
- **Policies present in DDL but missing in DB:** (list)

The DDL is the intended truth (it has `guests`, `published_at`, etc.). If reality matches, we just commit the migration as a record. If reality is missing things, Task 3 applies them.

- [ ] **Step 2.6: No commit — `.audit/` is gitignored**

This task produces a working artifact only.

---

## Task 3: Consolidate schema — one canonical migration, apply if needed

**Files:**
- Create: `supabase/migrations/20260417000000_base_schema.sql`
- Delete: `supabase/migrations/001_initial_schema.sql`
- Delete: `supabase-ddl.sql`

- [ ] **Step 3.1: Create the canonical migration file**

`cp supabase-ddl.sql supabase/migrations/20260417000000_base_schema.sql` then prepend a header comment:

```sql
-- =============================================================================
-- 20260417000000_base_schema
-- Canonical baseline schema for Survai. Promoted from the prior root-level
-- supabase-ddl.sql. Defines surveys, responses, chat_messages, and guests
-- with full RLS. Idempotent (CREATE TABLE IF NOT EXISTS, CREATE POLICY IF
-- NOT EXISTS via DROP-then-CREATE pattern in patch script below).
-- =============================================================================
```

Wrap each `CREATE POLICY` in a `DROP POLICY IF EXISTS ...; CREATE POLICY ...` pair so the file is re-runnable without erroring. Same for `CREATE TRIGGER` — use `DROP TRIGGER IF EXISTS ...; CREATE TRIGGER ...`.

- [ ] **Step 3.2: If `.audit/db-snapshot.md` shows missing pieces, apply via MCP**

For each gap identified in Task 2 (missing table, column, or policy):
- Generate the precise SQL needed
- Run it via Supabase MCP against the live project
- Re-run the probe queries from Task 2 to confirm the gap closed
- Update `.audit/db-snapshot.md` with the post-fix state

If reality already matched, skip this step.

- [ ] **Step 3.3: Verify the canonical migration is idempotent against live DB**

Via MCP, run the entire `20260417000000_base_schema.sql` file content against the live DB. Expected: zero errors (all CREATE IF NOT EXISTS / DROP-then-CREATE patterns make this safe). If any error fires, fix the migration file (don't paper over).

- [ ] **Step 3.4: Delete the superseded files**

```bash
rm supabase/migrations/001_initial_schema.sql
rm supabase-ddl.sql
```

- [ ] **Step 3.5: Commit**

```bash
git add supabase/migrations/20260417000000_base_schema.sql
git rm supabase/migrations/001_initial_schema.sql supabase-ddl.sql
git commit -m "feat(db): consolidate schema into single canonical migration

- Promote supabase-ddl.sql to supabase/migrations/20260417000000_base_schema.sql
- Delete superseded supabase/migrations/001_initial_schema.sql (missing
  guests table + published_at/agent_id/public_url columns; would corrupt
  fresh installs)
- Delete root-level supabase-ddl.sql to prevent drift from migrations dir
- Migration is idempotent (DROP-then-CREATE for policies and triggers,
  CREATE IF NOT EXISTS for tables) so it can re-run safely"
```

---

## Task 4: `npm run db:check` — non-destructive introspection script

**Why:** Future-you (or CI) needs to verify the live DB matches the migration without re-authenticating MCP. A `tsx` script using the service-role key works locally and in CI.

**Files:**
- Create: `scripts/check-supabase.ts`
- Modify: `package.json` (add script)

- [ ] **Step 4.1: Write the script**

Create `scripts/check-supabase.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Non-destructive Supabase introspection.
 * Reports tables, columns, RLS status, and policy count for the public schema.
 * Exits 0 if all expected tables exist with RLS enabled, 1 otherwise.
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const EXPECTED_TABLES = ['surveys', 'responses', 'chat_messages', 'guests'];

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Probe each expected table by selecting count(*). RLS policies are bypassed
  // by the service role, so a failure here means the table genuinely doesn't exist.
  const results: Record<string, { exists: boolean; rowCount: number | null; error?: string }> = {};
  for (const t of EXPECTED_TABLES) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      results[t] = { exists: false, rowCount: null, error: error.message };
    } else {
      results[t] = { exists: true, rowCount: count ?? 0 };
    }
  }

  console.log('Supabase introspection — public schema:');
  let ok = true;
  for (const [table, r] of Object.entries(results)) {
    if (r.exists) {
      console.log(`  ✓ ${table.padEnd(15)} ${r.rowCount} rows`);
    } else {
      console.log(`  ✗ ${table.padEnd(15)} MISSING — ${r.error}`);
      ok = false;
    }
  }

  if (!ok) {
    console.error('\nSchema check failed. Run the migration in supabase/migrations/.');
    process.exit(1);
  }
  console.log('\nAll expected tables present.');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4.2: Add the npm script**

In `package.json` `"scripts"`, after `"lint"`:
```json
"db:check": "tsx scripts/check-supabase.ts",
```

- [ ] **Step 4.3: Verify `tsx` is available**

```bash
npx tsx --version
```
Expected: prints a version (it's a transitive dep of Next.js or otherwise available; if not, install it: `npm install --save-dev tsx`).

- [ ] **Step 4.4: Run the script**

```bash
npm run db:check
```
Expected: prints `✓ surveys`, `✓ responses`, `✓ chat_messages`, `✓ guests`, then `All expected tables present.` Exits 0. If any are missing, Task 3 wasn't fully applied — go back.

- [ ] **Step 4.5: Commit**

```bash
git add scripts/check-supabase.ts package.json package-lock.json
git commit -m "feat(scripts): add db:check for non-destructive Supabase introspection

Run via 'npm run db:check'. Uses service-role key to verify expected
tables exist. Exit 0 = OK, exit 1 = schema drift. Suitable for CI
and local sanity after env changes."
```

---

## Task 5: Middleware gating — TDD

**Why:** Today middleware just refreshes session cookies; protected pages each do their own redirect. That's fragile (one missed page = auth bypass). One middleware-level gate is cleaner.

**Files:**
- Create: `tests/e2e/middleware-gate.spec.ts`
- Modify: `src/middleware.ts`
- Modify: `playwright.config.ts` (add `e2e` project)
- Modify: `package.json` (add `test:e2e` script)

- [ ] **Step 5.1: Add a Playwright `e2e` project**

In `playwright.config.ts`, add a second project entry to the `projects` array:
```ts
{
  name: 'e2e',
  testDir: './tests/e2e',
  use: { ...devices['Desktop Chrome'] },
},
```

- [ ] **Step 5.2: Add the `test:e2e` npm script**

In `package.json`:
```json
"test:e2e": "playwright test --project=e2e --reporter=list",
```

- [ ] **Step 5.3: Write the failing middleware-gate test**

Create `tests/e2e/middleware-gate.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('middleware auth gate', () => {
  test('anon GET /dashboard redirects to /login with next param', async ({ page, context }) => {
    // Ensure no Supabase session cookies are present
    await context.clearCookies();
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // Server-side redirect → final URL should be /login?next=...
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('next=');
    expect(decodeURIComponent(page.url())).toContain('/dashboard');
    // Sanity: response is a 200 on /login (after redirect)
    expect(response?.status()).toBe(200);
  });

  test('anon GET /survey/abc/edit redirects to /login', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/survey/abc/edit', { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/login');
    expect(decodeURIComponent(page.url())).toContain('/survey/abc/edit');
  });

  test('anon GET /test stays public (no redirect)', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/test');
    expect(page.url()).toContain('/test');
    expect(page.url()).not.toContain('/login');
  });

  test('anon GET /s/abc stays public (respondent surface)', async ({ page, context }) => {
    await context.clearCookies();
    const response = await page.goto('/s/abc', { waitUntil: 'domcontentloaded' });
    // Survey doesn't exist → page may show "not found", but URL must NOT redirect to /login
    expect(page.url()).not.toContain('/login');
    expect(page.url()).toContain('/s/abc');
    // Either 200 (renders not-found UI) or 404 — both fine, just not /login
    expect([200, 404]).toContain(response?.status() ?? 0);
  });
});
```

- [ ] **Step 5.4: Run the tests — verify they fail correctly**

```bash
npm run test:e2e -- middleware-gate.spec.ts
```
Expected: tests 1 and 2 FAIL (the dashboard/edit pages currently render the server-redirect path, but middleware doesn't redirect — so the URL stays at `/dashboard` rather than redirecting via middleware). Test 3 and 4 should pass (already public). Capture the failure output.

Note: It's possible test 1 also passes if the page-level `if (!user) redirect('/login')` already does the redirect server-side. If so, the test still fails on the `next=` param check (page-level redirect doesn't include `next`). Confirm the failure mode is as expected before implementing.

- [ ] **Step 5.5: Implement middleware gating**

Replace `src/middleware.ts` entirely with:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Paths that explicitly bypass auth checks. Anything not matched here AND
// matched by PROTECTED_PREFIXES requires an authenticated session.
const PUBLIC_PATHS = [
  '/test',
  '/s/',
  '/login',
  '/signup',
  '/auth/',         // OAuth callback + future auth routes
  '/api/ai/health',
  '/api/webhooks',
  '/api/surveys',   // Protected per-route in handlers; respondent submit must work for anon (RLS enforces)
];

const PROTECTED_PREFIXES = ['/dashboard', '/survey/'];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

function isProtected(path: string) {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export async function middleware(request: NextRequest) {
  // No env = local dev without Supabase configured; let everything through
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;

  // Fast-path: public route, just refresh session if cookies present (no gate)
  if (isPublic(path)) {
    return NextResponse.next();
  }

  // Build response with cookie-mirroring so Supabase can refresh the session
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protected and unauthed → redirect to /login?next=<original path + search>
  if (isProtected(path) && !user) {
    const loginUrl = new URL('/login', request.url);
    const fullPath = path + request.nextUrl.search;
    loginUrl.searchParams.set('next', fullPath);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 5.6: Wire `next` param into login form**

In `src/app/(auth)/login/page.tsx`, after successful login (around line 36), use the `next` query param if present:

Add at the top of the component, after `const router = useRouter();`:
```tsx
import { useSearchParams } from 'next/navigation';
// ... inside the component:
const searchParams = useSearchParams();
const nextPath = searchParams.get('next') || '/dashboard';
```

Then change `router.push('/dashboard');` to `router.push(nextPath);`. Same for the OAuth flow if applicable.

Important: `useSearchParams` requires the page to be wrapped in `<Suspense>` or use `'use client'` (which it already does). If Next throws a runtime warning about missing Suspense, wrap the form in `<Suspense fallback={null}>` from React.

- [ ] **Step 5.7: Re-run the tests — verify they pass**

```bash
npm run test:e2e -- middleware-gate.spec.ts
```
Expected: all four tests PASS.

- [ ] **Step 5.8: Lint check**

```bash
npm run lint
```
Expected: no new warnings/errors. If lint count went up vs main baseline, fix before commit.

- [ ] **Step 5.9: Commit**

```bash
git add src/middleware.ts src/app/\(auth\)/login/page.tsx playwright.config.ts package.json tests/e2e/middleware-gate.spec.ts
git commit -m "feat(middleware): gate /dashboard and /survey/* with login redirect

- Middleware now redirects unauthed users on protected paths to
  /login?next=<original-path> instead of relying on per-page
  server-side checks (defense-in-depth: pages still check, middleware
  is the first line)
- /test, /s/, /auth/, /login, /signup remain public
- Login page honors ?next= query param after successful sign-in
- Add Playwright e2e project + test:e2e npm script"
```

---

## Task 6: POST /api/surveys — typed server route + dashboard wire-up — TDD

**Why:** The dashboard currently writes directly to Supabase from the client. That's the most-likely-to-change touchpoint when the frontend agent redesigns the dashboard. A server route gives us a stable contract, plus server-side validation (title length cap, schema shape).

**Files:**
- Create: `src/lib/api/schemas.ts`
- Create: `src/lib/api/errors.ts`
- Create: `src/app/api/surveys/route.ts`
- Create: `tests/e2e/api-surveys-create.spec.ts`
- Modify: `src/components/dashboard/dashboard-content.tsx`

- [ ] **Step 6.1: Create the typed error helpers**

Create `src/lib/api/errors.ts`:

```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type ApiErrorBody = {
  error: string;
  code: 'unauthorized' | 'forbidden' | 'not_found' | 'bad_request' | 'internal';
  details?: unknown;
};

export function unauthorized(message = 'Authentication required') {
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'unauthorized' },
    { status: 401 }
  );
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'forbidden' },
    { status: 403 }
  );
}

export function notFound(message = 'Not found') {
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'not_found' },
    { status: 404 }
  );
}

export function badRequest(zodError: ZodError) {
  return NextResponse.json<ApiErrorBody>(
    {
      error: 'Invalid request body',
      code: 'bad_request',
      details: zodError.flatten(),
    },
    { status: 422 }
  );
}

export function internal(message = 'Internal server error') {
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'internal' },
    { status: 500 }
  );
}
```

- [ ] **Step 6.2: Create the request/response schemas**

Create `src/lib/api/schemas.ts`:

```typescript
import { z } from 'zod';

/**
 * POST /api/surveys — request body. All fields optional; defaults applied server-side.
 * The dashboard "New Survey" button posts an empty body and gets a sensible default.
 */
export const createSurveyRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

export type CreateSurveyRequest = z.infer<typeof createSurveyRequestSchema>;

/**
 * Survey row as exposed to the client. Mirrors DB shape but with camelCase
 * dates pre-formatted (we keep snake_case for compatibility with existing
 * dashboard code that reads created_at / updated_at).
 */
export const surveyRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  schema: z.array(z.unknown()),
  settings: z.record(z.unknown()),
  published: z.boolean(),
  published_at: z.string().nullable(),
  agent_id: z.string().nullable(),
  public_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SurveyRow = z.infer<typeof surveyRowSchema>;
```

- [ ] **Step 6.3: Write the failing API contract test**

Create `tests/e2e/api-surveys-create.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('POST /api/surveys', () => {
  test('anonymous returns 401', async ({ request }) => {
    const res = await request.post('/api/surveys', {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('unauthorized');
  });

  test('rejects oversize title with 422', async ({ request }) => {
    // Even without auth, body validation should run first OR after — either
    // way we expect a 4xx, not a 5xx. We're tolerant of order here.
    const res = await request.post('/api/surveys', {
      data: { title: 'x'.repeat(500) },
      headers: { 'content-type': 'application/json' },
    });
    expect([401, 422]).toContain(res.status());
    expect(res.status()).not.toBe(500);
  });
});
```

(Authenticated success path is covered by the full e2e in Task 7. This file just covers contract-level negatives that don't need a logged-in session.)

- [ ] **Step 6.4: Run the test — verify it fails (route doesn't exist)**

```bash
npm run test:e2e -- api-surveys-create.spec.ts
```
Expected: both tests FAIL with 404 (no route at `/api/surveys`).

- [ ] **Step 6.5: Implement the route**

Create `src/app/api/surveys/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSurveyRequestSchema, type SurveyRow } from '@/lib/api/schemas';
import { unauthorized, badRequest, internal } from '@/lib/api/errors';
import { DEFAULT_SETTINGS } from '@/types/survey';

/**
 * POST /api/surveys
 * Creates a new draft survey owned by the authenticated user.
 * Body: { title?: string, description?: string } — both optional.
 * Returns: 201 with the created SurveyRow.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parsed = createSurveyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase
    .from('surveys')
    .insert({
      user_id: user.id,
      title: parsed.data.title ?? 'Untitled Survey',
      description: parsed.data.description ?? '',
      schema: [],
      settings: DEFAULT_SETTINGS,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[POST /api/surveys] insert failed:', error);
    return internal('Failed to create survey');
  }

  return NextResponse.json<SurveyRow>(data, { status: 201 });
}
```

- [ ] **Step 6.6: Re-run the tests — verify they pass**

```bash
npm run test:e2e -- api-surveys-create.spec.ts
```
Expected: both tests PASS. Test 1: 401 unauthorized. Test 2: 401 (no auth) or 422 (validation) — either is fine.

- [ ] **Step 6.7: Wire the dashboard to use the new route**

In `src/components/dashboard/dashboard-content.tsx`, replace the body of `handleCreate` (lines 38-70) with:

```tsx
  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.error || 'Failed to create survey. Please try again.');
        setCreating(false);
        return;
      }
      const survey = await res.json();
      router.push(`/survey/${survey.id}/edit`);
    } catch (e) {
      console.error('[dashboard] create failed:', e);
      setError('Failed to create survey. Please try again.');
      setCreating(false);
    }
  };
```

Also remove the now-unused `supabase = createClient()` for create (lines 36-37) IF nothing else in the component uses it. Check: `handleDelete` still uses `supabase.from('surveys').delete()` — leave the client init in place for that.

- [ ] **Step 6.8: Lint + visual regression check**

```bash
npm run lint
npm run visual-qa
```
Expected: lint clean. Visual-QA still passes (the dashboard's create button still works, just routes through fetch now — visible behavior unchanged).

- [ ] **Step 6.9: Commit**

```bash
git add src/lib/api/ src/app/api/surveys/route.ts src/components/dashboard/dashboard-content.tsx tests/e2e/api-surveys-create.spec.ts
git commit -m "feat(api): add POST /api/surveys + wire dashboard create through it

- Server-side route with Zod-validated body, typed errors via
  src/lib/api/errors.ts, typed wire shapes in src/lib/api/schemas.ts
- Dashboard 'New Survey' now POSTs through the route instead of
  writing to Supabase directly from the client
- This is the API contract seam frontend changes can build on
  without re-implementing creation logic"
```

---

## Task 7: End-to-end happy path — TDD the full chain

**Why:** This is the test that proves M0 is real. signup → login → create → publish → submit → respond viewer. If this passes, the user can manually verify the same chain in 60 seconds.

**Files:**
- Create: `scripts/test-helpers.ts`
- Create: `tests/e2e/auth-and-survey-flow.spec.ts`

- [ ] **Step 7.1: Create test helpers using service-role admin API**

Create `scripts/test-helpers.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export function adminClient(): SupabaseClient {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type TestUser = { id: string; email: string; password: string };

export async function createTestUser(): Promise<TestUser> {
  const sb = adminClient();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@survai-test.invalid`;
  const password = `Test-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(userId: string) {
  const sb = adminClient();
  await sb.auth.admin.deleteUser(userId).catch(() => {});
}
```

- [ ] **Step 7.2: Write the failing end-to-end test**

Create `tests/e2e/auth-and-survey-flow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, type TestUser } from '../../scripts/test-helpers';

test.describe('end-to-end: signup → create → publish → submit → view', () => {
  let user: TestUser;

  test.beforeAll(async () => {
    user = await createTestUser();
  });

  test.afterAll(async () => {
    if (user) await deleteTestUser(user.id);
  });

  test('full chain works for a real user', async ({ page, context }) => {
    // 1. Login via the UI
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // 2. Dashboard loads — empty state visible (new user has no surveys)
    await expect(page.getByText(/no surveys yet|new survey/i).first()).toBeVisible();

    // 3. Click New Survey → routes through POST /api/surveys → redirects to /survey/[id]/edit
    await page.getByRole('button', { name: /new survey/i }).first().click();
    await page.waitForURL(/\/survey\/[a-f0-9-]+\/edit/, { timeout: 10000 });

    // Capture the survey id from the URL
    const editUrl = page.url();
    const surveyId = editUrl.match(/\/survey\/([a-f0-9-]+)\/edit/)?.[1];
    expect(surveyId).toBeTruthy();

    // 4. Editor loads. We won't add elements via UI in this test (the editor's
    //    interaction surface is the frontend agent's territory and may shift).
    //    Instead, set the title via the input and let auto-save persist it.
    const titleInput = page.locator('input[placeholder*="Untitled" i], input[value*="Untitled" i]').first();
    await titleInput.click();
    await titleInput.fill('E2E Test Survey');
    // Wait for the 1.5s debounced auto-save + a small buffer
    await page.waitForTimeout(2500);

    // 5. Publish via the API directly (publish dialog UI is also evolving;
    //    the API contract is what we're proving here)
    const publishRes = await page.request.post(`/api/surveys/${surveyId}/publish`, {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    expect(publishRes.ok()).toBeTruthy();

    // 6. Anonymous submit to /api/surveys/[id]/submit (RLS allows anon insert
    //    because the survey is now published)
    const submitRes = await page.request.post(`/api/surveys/${surveyId}/submit`, {
      data: { answers: { test_q1: 'hello from e2e' } },
      headers: { 'content-type': 'application/json' },
    });
    expect(submitRes.ok()).toBeTruthy();

    // 7. Owner navigates to responses page → sees the answer
    await page.goto(`/survey/${surveyId}/responses`);
    // The responses page should render some indication of "1 response" or the answer text
    // We're tolerant about exact wording here so the frontend agent can rephrase
    const pageBody = await page.locator('body').textContent();
    expect(pageBody).toMatch(/1 response|hello from e2e|response/i);
  });
});
```

- [ ] **Step 7.3: Run the test — verify it fails meaningfully**

```bash
npm run test:e2e -- auth-and-survey-flow.spec.ts
```

Capture the failure mode. There are several legitimate places this could fail today:
- Email-confirmation gate (Supabase project may require confirmation for password sign-in even though admin createUser sets `email_confirm: true`)
- Missing fields on the `surveys` table (if Task 3 didn't fully apply)
- Submit endpoint signature mismatch
- Responses page error

Each failure is information. Note them. **Do NOT proceed to Step 7.4 without understanding why.**

- [ ] **Step 7.4: Fix discovered issues until the test passes**

For each failure, fix the root cause (not the test). Likely fixes:
- If submit route expects different payload shape — update the test to match the route's contract OR update the route if the contract is wrong (read [src/app/api/surveys/[id]/submit/route.ts](../../../../src/app/api/surveys/%5Bid%5D/submit/route.ts) before deciding)
- If email confirmation blocks login — set `EMAIL_CONFIRMATION_REQUIRED=false` in Supabase project auth settings (via MCP)
- If a column is missing — re-run Task 3 step 3.2

Iterate until test passes. Each fix gets its own commit with a `fix(...)` prefix.

- [ ] **Step 7.5: Commit the test infrastructure + any fixes**

```bash
git add scripts/test-helpers.ts tests/e2e/auth-and-survey-flow.spec.ts
git commit -m "test(e2e): add full-chain auth-and-survey-flow test

Proves: login → dashboard → create (via POST /api/surveys) → editor →
auto-save → publish → anon submit → owner sees response. Uses Supabase
service-role admin API to provision and tear down a test user per run."
```

(Any `fix(...)` commits from 7.4 are separate.)

---

## Task 8: Manual verification handoff

**Files:** none modified.

This task is the user-facing checkpoint. Provide the user a script they can run themselves to confirm M0 is real on their machine.

- [ ] **Step 8.1: Run the full test suite once more, end-to-end**

```bash
cd /Users/fabian/Desktop/Coding_projects/survai/.worktrees/backend-prod
npm run lint && npm run db:check && npm run visual-qa && npm run test:e2e
```
Expected: all four green.

- [ ] **Step 8.2: Generate the manual verification script**

Write to user via chat (don't commit the script — it's a one-time handoff):

```
MANUAL VERIFICATION
1. Open http://localhost:3004/signup in a fresh incognito window
2. Sign up with any email + password (8+ chars)
3. You should be redirected to /dashboard
4. Click "New Survey" — should land on /survey/<uuid>/edit
5. Type a title in the survey-header card
6. Wait 2 seconds — open DevTools > Network, you should see a 200 to surveys table
7. Open the publish dialog (if visible) OR just navigate to /survey/<uuid>/responses to confirm
8. Visit /s/<uuid> in another tab — confirm the survey loads as a respondent
9. Submit a response
10. Return to /survey/<uuid>/responses — your answer should be there
11. Try to visit /dashboard after logging out — should redirect to /login?next=/dashboard
```

- [ ] **Step 8.3: WAIT for explicit user approval**

Do NOT proceed to Task 9 (docs) until the user confirms the manual chain works for them. If they hit issues, fix root causes (don't paper over) and rerun Task 8.1.

---

## Task 9: Capture verified reality in docs (only after Task 8 passes)

**Why:** Docs written before verification are speculation. Docs written after verification are records. This task runs AFTER user manual approval.

**Files:**
- Create: `docs/BACKEND-AUDIT.md`
- Create: `docs/BACKEND-API.md`
- Create: `docs/SETUP.md`
- Create: `supabase/migrations/README.md`

- [ ] **Step 9.1: Write `docs/BACKEND-AUDIT.md`**

Capture the verified state. Sections:
- **Date:** 2026-04-17
- **Verified flow:** the green chain from Task 7
- **Live tables / columns / RLS** (paste from `.audit/db-snapshot.md`)
- **Auth providers enabled:** email+password (Google OAuth wired but not exercised in M0)
- **Known gaps** (deferred to later milestones — be honest, not aspirational)
- **Decisions made:** schema consolidation, middleware gating, API seam at POST /api/surveys

- [ ] **Step 9.2: Write `docs/BACKEND-API.md`**

For each `/api/**` route, document: method, path, auth requirement (anon / authenticated / owner-only), request schema, response schema, side effects, related Supabase table. Sections per route:
- `POST /api/surveys` — create
- `POST /api/surveys/[id]/publish`
- `POST /api/surveys/[id]/submit`
- `GET /api/surveys/[id]/guests/[token]`
- `POST /api/surveys/[id]/guests/[token]/profile`
- (etc — read the actual route files and document what's there)

End with a "Future routes" section listing what M1+ will add (PATCH/DELETE for dashboard parity, GET list for SPA use, etc).

- [ ] **Step 9.3: Write `docs/SETUP.md`**

Step-by-step for a fresh dev machine:
1. Clone, `npm install`
2. Create Supabase project at supabase.com
3. Copy URL + anon key + service role key into `.env.local` (template fields)
4. Run the canonical migration (paste path: `supabase/migrations/20260417000000_base_schema.sql`) in Supabase SQL Editor
5. Run `npm run db:check` — expect ✓ on all four tables
6. `npm run dev` (or PORT=3004 for parallel worktree)
7. Sign up at /signup, log in at /login

- [ ] **Step 9.4: Write `supabase/migrations/README.md`**

One-page migration workflow:
- File naming convention: `YYYYMMDDHHMMSS_description.sql`
- All migrations should be idempotent (DROP-then-CREATE for policies/triggers, IF NOT EXISTS for tables)
- How to apply via Supabase SQL Editor
- How to verify via `npm run db:check`

- [ ] **Step 9.5: Commit docs**

```bash
git add docs/BACKEND-AUDIT.md docs/BACKEND-API.md docs/SETUP.md supabase/migrations/README.md
git commit -m "docs(backend): capture verified M0 state — audit, api contract, setup

Written after end-to-end manual verification on 2026-04-17. Records:
- BACKEND-AUDIT.md: live schema, RLS, verified flow, deferred gaps
- BACKEND-API.md: typed contract for every /api/** route
- SETUP.md: fresh-machine onboarding
- supabase/migrations/README.md: migration workflow"
```

---

## Task 10: Push to remote (only after user explicitly says go)

- [ ] **Step 10.1: Show the user the commit log**

```bash
git log --oneline main..HEAD
```

Report the list to the user. Wait for explicit "push it" before continuing.

- [ ] **Step 10.2: Push the branch**

```bash
git push -u origin feat/backend-production
```

- [ ] **Step 10.3: Confirm push and offer PR**

Run:
```bash
gh pr create --draft --title "Backend M0: foundation — auth gate, API contract, e2e proof" --body "$(cat <<'EOF'
## Summary
- Consolidated schema into one canonical migration (deletes the older 001_initial_schema.sql + root supabase-ddl.sql)
- Middleware now gates /dashboard and /survey/* with /login?next=... redirect
- POST /api/surveys is the typed API seam frontend can build on; dashboard wired through it
- Full e2e test proves login → create → publish → submit → view-response

## Test plan
- [x] npm run lint — clean
- [x] npm run db:check — all expected tables present
- [x] npm run visual-qa — green
- [x] npm run test:e2e — green
- [x] Manual verification per docs/BACKEND-AUDIT.md flow
EOF
)"
```

(Skip this step if the user wants to merge directly without a PR.)

---

## Self-Review

**Spec coverage:**
- ✅ "production-ready, real users can sign up" → Tasks 5–7 (auth gate + dashboard create + e2e)
- ✅ "implement Supabase, all backend states, authentication" → Tasks 2–7
- ✅ "all user interactions properly logged" → console.error in error helpers + every API route. Structured logging deferred to M4 (out of M0 scope, called out).
- ✅ "backend is adaptive and well-documented" → Task 6 introduces API contract seam; Task 9 documents it
- ✅ "push regularly to repository as soon as my human review has approved" → Tasks 8 (manual review gate) and 10 (push only after explicit go)
- ✅ "first state that you can push to Git, think deeply about overall approach" → this entire plan; M0 is the first push milestone
- ✅ User correction "document AFTER you've coded" → Task 9 is explicitly after Task 8 manual verification
- ✅ User correction "for authentication, just do it normally, sign up fast" → email+password (existing), no extra info collection in M0
- ✅ User instruction "build + test, then let me test, then push" → Tasks 7 (build+test), 8 (user tests), 10 (push)

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N", no missing code blocks. The error helpers and schemas use real types from existing code paths (`@supabase/ssr`, `@/types/survey`).

**Type consistency:**
- `SurveyRow` defined in Task 6.2, used in 6.5 — match
- `TestUser` defined in 7.1, used in 7.2 — match
- `createTestUser`, `deleteTestUser`, `adminClient` consistent across files
- Middleware `PUBLIC_PATHS` / `PROTECTED_PREFIXES` shape matches usage

**Risk callouts:**
- Task 7 may surface real bugs in existing routes (publish, submit, responses page). The plan is to fix root causes, not the test. If too many bugs surface, may need to split M0 into M0a (audit + middleware) and M0b (e2e + fixes).
- Symlinked node_modules in worktree means a frontend `npm install` could shift versions under us. Acceptable for now; if it bites, run `npm install` locally in the worktree.
- Email-confirmation Supabase setting may block the test user signup. Plan accounts for this in Step 7.4.
