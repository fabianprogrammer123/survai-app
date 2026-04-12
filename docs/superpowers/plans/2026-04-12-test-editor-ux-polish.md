# /test Editor UX Polish & Native AI Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the `/test` editor so creating a blank survey feels clean, native, and AI-first — fix the serif font leak on the survey header, remove template clutter on the blank path, make the chat panel proactively greet the user, restore microphone symmetry, tighten light-mode contrast, and wire up an on-demand visual-QA Playwright harness.

**Architecture:** Surgical edits to existing components — no new abstractions, no schema changes, no backend, no auth. localStorage-only persistence stays unchanged. Playwright is added as a devDependency purely for visual QA and does NOT replace any existing runtime behavior. All changes are scoped to the `/test` flow and the shared survey editor components it imports.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind 4, shadcn/ui, Zustand 5, Playwright (new devDep).

**Out of scope (separate plans):**
- **Plan B** — real Google-Forms-vs-Typeform layout divergence (scroll-all vs one-question-at-a-time with framer-motion transitions).
- **Plan C** — respondent answer modes (voice / text / both) with ElevenLabs wiring.
- **Plan D** — Supabase auth, multi-tenant persistence, publish flow, shareable `/s/[id]` links, RLS, migration from localStorage.

**Inspiration references (from open-source survey-tool GitHub research):**
- [Formbricks](https://github.com/formbricks/formbricks) — three-pane editor polish (Next.js, TS, Tailwind, Radix).
- [OpnForm](https://github.com/OpnForm/OpnForm) — public-form typography / spacing reference (Laravel + Vue; visual only).
- [QuillForms](https://github.com/quillforms/quillforms) — Typeform-feel transitions (Plan B reference, not used here).
- [AnushDeokar/typeform-clone](https://github.com/AnushDeokar/typeform-clone) — tiny Next 14 Framer-Motion reference (Plan B reference, not used here).

**Development server:** A dev server is already running on `http://localhost:3002` (pid 15472). All Playwright tests and manual verification target port **3002**, not 3000.

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `playwright.config.ts` | Playwright config targeting `http://localhost:3002`, 1 browser (chromium), screenshot folder pinned |
| `tests/visual/editor.spec.ts` | Visual-QA smoke suite: navigate /test → blank → assert layout state, take screenshots |
| `tests/visual/README.md` | Short how-to on running visual-qa and where artifacts land |
| `src/lib/survey/proactive-greeting.ts` | Pure function returning the proactive opening assistant message for a blank survey. Single responsibility so it can be swapped and unit-tested later. |

### Files to modify

| Path | Change |
|---|---|
| `package.json` | Add `@playwright/test` devDep + `visual-qa` script |
| `src/app/globals.css` | Fix `--font-sans` self-reference (line 8); fix `.font-survey-inter` fallback (line 343); light-mode polish vars |
| `src/lib/survey/presets.ts` | Tighten `google-forms-light` and `typeform-light` CSS variables for contrast/shadows |
| `src/components/survey/editor/survey-header-card.tsx` | Explicit font-family on title input to defend against theme regressions |
| `src/components/survey/editor/editor-canvas.tsx` | Remove `<TemplateGallery />` render at line 167 |
| `src/components/survey/chat/chat-input-area.tsx` | Restructure flex row so mic sits symmetrically inside the input wrapper on the right |
| `src/components/survey/chat/voice-input-button.tsx` | Tighten size/spacing to match send button weight |
| `src/components/survey/chat/chat-panel.tsx` | Seed proactive greeting on first mount when store has zero chat messages AND zero elements |
| `src/components/survey/chat/chat-empty-state.tsx` | Strip the 4 template suggestion cards; keep only the sparkle hero (will rarely render once proactive seeding lands, but defensible fallback) |
| `src/lib/survey/store.ts` | Add `hasSeededProactiveGreeting` flag to prevent re-seeding across remounts |

### Files NOT touched (explicit)
- `src/components/survey/editor/template-gallery.tsx` — component stays, we just stop mounting it from the canvas. The `/test` dashboard homepage keeps using it.
- `src/app/test/page.tsx`, `src/app/test/edit/page.tsx` — layout shell is fine.
- Any `src/app/api/**` route — no API changes.
- `src/app/page.tsx` — marketing landing, explicitly out of scope per user instruction.

---

## Task 1: Playwright smoke harness

**Why first:** We cannot regression-check visual work without a harness. Setting it up once unblocks every subsequent task.

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `tests/visual/editor.spec.ts`
- Create: `tests/visual/README.md`

- [ ] **Step 1.1: Install Playwright**

Run:
```bash
npm install --save-dev @playwright/test@^1.47.0
npx playwright install chromium
```

Expected: two lockfile changes, chromium downloaded to `~/Library/Caches/ms-playwright/`.

- [ ] **Step 1.2: Add `visual-qa` npm script**

Edit `package.json`. Under `"scripts"`, add `visual-qa` after `lint`:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "visual-qa": "playwright test --reporter=list"
  },
```

- [ ] **Step 1.3: Create `playwright.config.ts`**

Create the file at the repo root with this exact content:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: './tests/visual/.artifacts',
});
```

- [ ] **Step 1.4: Create the first smoke test**

Create `tests/visual/editor.spec.ts` with this exact content:

```ts
import { test, expect } from '@playwright/test';

test.describe('/test editor — smoke', () => {
  test('dashboard loads and shows template row', async ({ page }) => {
    await page.goto('/test');
    await expect(page).toHaveTitle(/Axiom|Survey|Untitled/i);
    // The template row on /test dashboard should be visible
    await expect(page.getByText(/Blank form/i).first()).toBeVisible();
    await page.screenshot({
      path: 'tests/visual/.artifacts/01-dashboard.png',
      fullPage: true,
    });
  });

  test('blank form → editor loads without serif title', async ({ page }) => {
    await page.goto('/test');
    await page.getByText(/Blank form/i).first().click();
    // style-selector dialog appears
    await expect(page.getByText(/Google Forms/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Google Forms/i }).first().click();
    await page.getByRole('button', { name: /continue|create|start/i }).click();
    await page.waitForURL(/\/test\/edit/);

    // The title input should be visible
    const title = page.locator('input[placeholder="Untitled Survey"]');
    await expect(title).toBeVisible();

    // Computed font-family must NOT be a serif fallback
    const fontFamily = await title.evaluate((el) =>
      window.getComputedStyle(el).fontFamily
    );
    expect(fontFamily.toLowerCase()).not.toMatch(/times|serif(?!.*sans)/);

    await page.screenshot({
      path: 'tests/visual/.artifacts/02-blank-editor.png',
      fullPage: true,
    });
  });
});
```

- [ ] **Step 1.5: Create `tests/visual/README.md`**

Create the file with:

```md
# Visual QA

On-demand Playwright harness for the `/test` editor.

## Prerequisites

- Dev server running on `http://localhost:3002`
- `npx playwright install chromium` has been run at least once

## Run

```bash
npm run visual-qa
```

Screenshots land in `tests/visual/.artifacts/`. Review them manually — the suite only fails on hard assertions (element missing, serif leaking, page crash).

## Adding cases

Each new case should:
1. Navigate to the state you want to verify
2. Make at least one hard assertion (getByRole, expect visible, computed style)
3. Take a full-page screenshot with a numbered filename
```

- [ ] **Step 1.6: Run the harness to establish baseline**

Run:
```bash
npm run visual-qa
```

Expected: both tests run. The **second test WILL fail** on the serif assertion — that's the bug we're about to fix in Task 2. Confirm the failure is specifically on the `not.toMatch(/times|serif/)` assertion, not a flaky click. Take a note of the output for comparison after Task 2.

- [ ] **Step 1.7: Add `.artifacts/` to `.gitignore`**

Append to `.gitignore`:

```
tests/visual/.artifacts/
```

- [ ] **Step 1.8: Commit**

```bash
git add playwright.config.ts tests/visual/ package.json package-lock.json .gitignore
git commit -m "chore: add Playwright visual-QA harness for /test editor"
```

---

## Task 2: Fix the serif font leak (root cause)

**Diagnosis:** [src/app/globals.css:8](../../../src/app/globals.css#L8) defines `--font-sans: var(--font-sans);` — a self-reference that resolves to undefined. [src/app/globals.css:343](../../../src/app/globals.css#L343) defines `.font-survey-inter { font-family: var(--font-sans); }` with no fallback. [src/app/layout.tsx:2](../../../src/app/layout.tsx#L2) never loads Inter. Result: the SurveyThemeProvider applies `.font-survey-inter` to the editor, that class resolves to nothing, and the browser falls back to its default serif.

**Fix strategy:** Point `.font-survey-inter` at an already-loaded sans font (Geist, which is closest to Google Sans), and fix the circular `--font-sans` theme variable. Belt-and-braces: add an explicit `font-sans` class on the `SurveyHeaderCard` title input so a future theme regression can't reintroduce the bug.

**Files:**
- Modify: `src/app/globals.css` (lines 8 and 343)
- Modify: `src/components/survey/editor/survey-header-card.tsx` (line 26)
- Test: `tests/visual/editor.spec.ts` (already asserts non-serif from Task 1)

- [ ] **Step 2.1: Verify the bug is currently reproducible**

Run:
```bash
npm run visual-qa 2>&1 | grep -A2 serif
```

Expected: the assertion on computed font-family fails, matching `times` or `serif`. This confirms we are about to fix the right bug.

- [ ] **Step 2.2: Fix the circular `--font-sans` theme var**

In `src/app/globals.css`, change line 8 from:

```css
  --font-sans: var(--font-sans);
```

to:

```css
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
```

- [ ] **Step 2.3: Fix the `.font-survey-inter` rule**

In `src/app/globals.css`, change line 343 from:

```css
.font-survey-inter { font-family: var(--font-sans); }
```

to:

```css
.font-survey-inter { font-family: var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
```

Rationale: Geist is already loaded in `layout.tsx` via the `--font-geist-sans` variable and is visually very close to Google Sans / Product Sans. The long fallback chain defends against future font-loading regressions.

- [ ] **Step 2.4: Belt-and-braces: force `font-sans` on the survey title input**

In `src/components/survey/editor/survey-header-card.tsx`, change line 26 from:

```tsx
        className="border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/30 rounded-lg px-3 -mx-3 py-1 transition-colors"
```

to:

```tsx
        className="font-sans border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/30 rounded-lg px-3 -mx-3 py-1 transition-colors"
```

Also change the Textarea className one line below (line 32) in the same way — prepend `font-sans`:

```tsx
        className="font-sans border-none text-muted-foreground p-0 mt-1 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] hover:bg-muted/30 rounded-lg px-3 -mx-3 py-1 transition-colors"
```

- [ ] **Step 2.5: Re-run the visual harness**

Run:
```bash
npm run visual-qa
```

Expected: both tests now PASS. The second test's computed-font-family assertion no longer trips. Open `tests/visual/.artifacts/02-blank-editor.png` and eyeball the title — it should be a clean Geist sans-serif, not a wedge-serif.

- [ ] **Step 2.6: Commit**

```bash
git add src/app/globals.css src/components/survey/editor/survey-header-card.tsx
git commit -m "fix(editor): resolve serif font fallback on survey title

globals.css had --font-sans defined as var(--font-sans) (self-reference,
undefined), and .font-survey-inter used that undefined variable with no
fallback. The browser fell back to its default serif on the editor's
SurveyThemeProvider-wrapped title, producing a Times-New-Roman feel.

Point --font-sans at the already-loaded Geist variable with a full
system-font fallback chain, and belt-and-braces force font-sans on the
SurveyHeaderCard title/description so future theme regressions cannot
reintroduce the bug."
```

---

## Task 3: Remove template gallery from blank-survey editor canvas

**Why:** User explicitly said: once deciding to create a blank survey, the editor should be a blank experience with a native AI-first feel. The inline `<TemplateGallery />` render at [src/components/survey/editor/editor-canvas.tsx:167](../../../src/components/survey/editor/editor-canvas.tsx#L167) produces the "Start with a template / Pick a starting point" block from the screenshot. Remove it. Templates already live on the `/test` dashboard homepage, which is a different surface entirely.

**Files:**
- Modify: `src/components/survey/editor/editor-canvas.tsx` (remove line 167 and stale import at line 24)
- Test: add a Playwright assertion that the phrase is NOT present

- [ ] **Step 3.1: Add a failing Playwright assertion**

In `tests/visual/editor.spec.ts`, inside the `'blank form → editor loads without serif title'` test, after the font-family assertion and BEFORE the screenshot call, add:

```ts
    // The inline "Start with a template" block must not render in the blank-survey editor
    await expect(page.getByText(/Start with a template/i)).toHaveCount(0);
    await expect(page.getByText(/Pick a starting point/i)).toHaveCount(0);
```

- [ ] **Step 3.2: Run to verify it fails**

```bash
npm run visual-qa
```

Expected: the new assertion fails because `TemplateGallery` still renders when `elements.length === 0`.

- [ ] **Step 3.3: Remove the `<TemplateGallery />` mount**

In `src/components/survey/editor/editor-canvas.tsx`:

- **Remove line 167:**

```tsx
            {elements.length === 0 && <TemplateGallery />}
```

- **Remove the now-unused import at line 24:**

```tsx
import { TemplateGallery } from './template-gallery';
```

- [ ] **Step 3.4: Re-run Playwright**

```bash
npm run visual-qa
```

Expected: PASS. The editor shows `SurveyHeaderCard` + `AddElementButton` and nothing else when empty. Screenshot `02-blank-editor.png` should no longer show the six template cards.

- [ ] **Step 3.5: Lint to ensure no unused-import warning sneaked back in**

```bash
npm run lint
```

Expected: clean exit. If it flags anything, remove the offending line.

- [ ] **Step 3.6: Commit**

```bash
git add src/components/survey/editor/editor-canvas.tsx tests/visual/editor.spec.ts
git commit -m "feat(editor): remove inline template gallery from blank-survey canvas

The /test/edit blank-survey path should feel like a blank AI-native
canvas, not a template picker. Templates still live on the /test
dashboard homepage. Drop the 'Start with a template' block from the
editor canvas entirely."
```

---

## Task 4: Seed proactive AI opening message

**Why:** User wants a native AI experience where the assistant proactively greets and asks what to build. Currently `chatMessages: []` on load and the panel silently waits. We will seed one assistant message on first mount of `ChatPanel` when both conditions hold: the survey has zero elements AND the chat has zero messages AND we haven't already seeded. We persist a `hasSeededProactiveGreeting` flag in the store so remounts don't re-seed.

**Files:**
- Create: `src/lib/survey/proactive-greeting.ts`
- Modify: `src/lib/survey/store.ts` (add flag + setter)
- Modify: `src/components/survey/chat/chat-panel.tsx` (add mount effect)

- [ ] **Step 4.1: Create the greeting helper**

Create `src/lib/survey/proactive-greeting.ts` with:

```ts
import type { ChatMessage } from '@/types/survey';
import { nanoid } from 'nanoid';

/**
 * Returns the proactive opening assistant message shown when the
 * user lands on a blank survey editor. Kept as a pure function so
 * the copy can be iterated on without touching UI or store code.
 */
export function buildProactiveGreeting(): ChatMessage {
  return {
    id: nanoid(),
    role: 'assistant',
    content:
      "Hey — I'm your survey co-pilot. Tell me what you're trying to learn and who you're asking, and I'll draft the questions. For example: \"customer onboarding feedback for a B2B SaaS, 5 minutes, focused on the first-week experience.\" What are we building?",
    timestamp: new Date().toISOString(),
  };
}
```

- [ ] **Step 4.2: Add `hasSeededProactiveGreeting` to the store**

In `src/lib/survey/store.ts`, add to the `SurveyEditorState` interface (around line 38, near the `isStreaming` flag):

```ts
  /** Whether the proactive AI greeting has already been seeded this session. */
  hasSeededProactiveGreeting: boolean;
```

Add the setter to the interface (near `setChatMessages`, around line 82):

```ts
  markProactiveGreetingSeeded: () => void;
```

Add the default value to the store (near line 161 where `recentlyAddedIds: []` is defined):

```ts
  hasSeededProactiveGreeting: false,
```

Add the setter implementation inside `create<SurveyEditorState>((set, get) => ({ ... }))`. Find the block where `setChatMessages` is implemented and add directly after it:

```ts
  markProactiveGreetingSeeded: () => set({ hasSeededProactiveGreeting: true }),
```

(If you cannot locate `setChatMessages` in the current file layout, append the setter near the bottom of the store actions block — the placement is not load-bearing.)

- [ ] **Step 4.3: Seed the greeting from `ChatPanel` on first mount**

In `src/components/survey/chat/chat-panel.tsx`, add the import at the top (after line 15):

```ts
import { buildProactiveGreeting } from '@/lib/survey/proactive-greeting';
```

Then, inside the `ChatPanel` function, after the existing `useEffect` blocks (after line 56, where TTS effect ends), add:

```tsx
  // Seed the proactive AI greeting on first mount for blank surveys.
  useEffect(() => {
    const store = useSurveyStore.getState();
    if (
      !store.hasSeededProactiveGreeting &&
      store.chatMessages.length === 0 &&
      store.survey.elements.length === 0
    ) {
      store.addChatMessage(buildProactiveGreeting());
      store.markProactiveGreetingSeeded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4.4: Add a Playwright assertion**

In `tests/visual/editor.spec.ts`, add a new test case at the bottom of the `describe` block:

```ts
  test('blank editor seeds a proactive assistant greeting', async ({ page }) => {
    await page.goto('/test');
    await page.getByText(/Blank form/i).first().click();
    await page.getByRole('button', { name: /Google Forms/i }).first().click();
    await page.getByRole('button', { name: /continue|create|start/i }).click();
    await page.waitForURL(/\/test\/edit/);

    // The chat panel should contain a proactive assistant message mentioning "survey"
    await expect(page.getByText(/survey co-pilot|What are we building/i)).toBeVisible();

    // The old empty-state 4-suggestion grid must NOT be visible
    await expect(page.getByText(/Customer Satisfaction/i)).toHaveCount(0);
  });
```

- [ ] **Step 4.5: Run Playwright**

```bash
npm run visual-qa
```

Expected: all three tests pass. If the greeting does not appear, check that `ChatPanel` is actually mounted on `/test/edit` (it should be — the right panel defaults to the Chat tab).

- [ ] **Step 4.6: Commit**

```bash
git add src/lib/survey/proactive-greeting.ts src/lib/survey/store.ts src/components/survey/chat/chat-panel.tsx tests/visual/editor.spec.ts
git commit -m "feat(chat): seed proactive AI greeting on blank survey editor mount

The editor now opens with an assistant-initiated message asking what
the user is trying to learn, mirroring native AI-assistant UX. A
store-level hasSeededProactiveGreeting flag prevents re-seeding on
component remounts within the same session."
```

---

## Task 5: Simplify `ChatEmptyState` (strip template suggestion cards)

**Why:** Once Task 4 lands, `chatMessages.length === 0` should almost never be true on the blank path, so `ChatEmptyState` becomes a rare fallback. The 4 "Customer Satisfaction / Employee Engagement / Product Feedback / Event Feedback" template cards still render in that fallback state and conflict with the "native AI experience" directive. Remove them; keep a minimal sparkle hero + one-line pitch.

**Files:**
- Modify: `src/components/survey/chat/chat-empty-state.tsx`

- [ ] **Step 5.1: Replace the component body**

Open `src/components/survey/chat/chat-empty-state.tsx` and replace the entire file with:

```tsx
'use client';

import { Sparkles } from 'lucide-react';

interface ChatEmptyStateProps {
  // Kept for API compatibility with ChatPanel; no longer used but we
  // don't want to touch the caller in this task.
  onSuggestionClick?: (prompt: string) => void;
}

export function ChatEmptyState(_: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-10">
      <div className="relative mb-5">
        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-2xl scale-150" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-1.5">AI Assistant</h3>
      <p className="text-sm text-muted-foreground text-center max-w-[280px] leading-relaxed">
        Describe what you&apos;d like to build, or use the editor directly.
      </p>
    </div>
  );
}
```

- [ ] **Step 5.2: Verify the caller still compiles**

The `ChatPanel` at [src/components/survey/chat/chat-panel.tsx:119](../../../src/components/survey/chat/chat-panel.tsx#L119) passes `onSuggestionClick={(prompt) => handleSend(prompt, 'text')}`. The new `ChatEmptyState` accepts (and ignores) that prop, so no caller changes are required.

Run:
```bash
npm run lint
```

Expected: clean. If lint complains about the underscore-prefixed unused parameter, rename it per whatever convention the existing code uses (prefix with `_` is standard ESLint-unused-args escape).

- [ ] **Step 5.3: Run Playwright**

```bash
npm run visual-qa
```

Expected: all tests still pass. The `Customer Satisfaction` assertion in Task 4's test continues to pass because those cards are gone.

- [ ] **Step 5.4: Commit**

```bash
git add src/components/survey/chat/chat-empty-state.tsx
git commit -m "refactor(chat): strip template suggestion cards from empty state

With proactive greeting seeding, the empty state is now a rare
fallback. Reduce it to a sparkle hero + one-line pitch, aligning with
the native AI-experience direction."
```

---

## Task 6: Microphone button symmetry fix

**Why:** User said: "the microphone isn't centralised, isn't symmetric next to the 'Describe your survey' bar." Today at [src/components/survey/chat/chat-input-area.tsx:48-84](../../../src/components/survey/chat/chat-input-area.tsx#L48-L84) the layout is `[mic][textarea][send]` — mic floats left of the input with no visual coupling. Target: mic is an icon-button docked inside the textarea wrapper on the right, with send as the sole external action button. This mirrors ChatGPT / Gemini / Claude.ai chat input conventions and is the cleanest "native AI" pattern.

**Files:**
- Modify: `src/components/survey/chat/chat-input-area.tsx`
- Modify: `src/components/survey/chat/voice-input-button.tsx` (minor size tweak)

- [ ] **Step 6.1: Restructure the `ChatInputArea` flex row**

In `src/components/survey/chat/chat-input-area.tsx`, replace lines 48-84 (the entire returned JSX) with:

```tsx
  return (
    <div className="p-4 border-t border-border/60 shrink-0 bg-background">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your survey..."
            disabled={isLoading}
            rows={1}
            className={cn(
              'w-full resize-none rounded-xl border border-border/50 bg-muted/20 pl-4 pr-12 py-3 text-sm leading-relaxed',
              'placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30',
              'disabled:opacity-50 transition-all',
              'min-h-[44px] max-h-[120px]',
              'overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
          />
          {voiceButton && (
            <div className="absolute right-1.5 bottom-1.5">{voiceButton}</div>
          )}
        </div>
        <Button
          size="icon"
          className="h-11 w-11 rounded-xl shrink-0 shadow-sm"
          disabled={!input.trim() || isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
```

Key differences from the old JSX:
- The `{voiceButton}` render was hoisted out of the row and is now an `absolute right-1.5 bottom-1.5` child of the textarea's relative wrapper.
- The textarea gained `pr-12` padding-right so typed text never slides under the mic icon.
- The outer row is now just `[input-with-mic-docked-inside] [send]` — symmetric.

- [ ] **Step 6.2: Tighten the voice input button to match the docked position**

In `src/components/survey/chat/voice-input-button.tsx`, change line 29 from:

```tsx
        'relative h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0',
```

to:

```tsx
        'relative h-8 w-8 rounded-lg flex items-center justify-center transition-all shrink-0',
```

Also change the waveform bar height at line 52 from `${4 + audioLevel * 12}px` to `${3 + audioLevel * 10}px` so the bars don't overflow the smaller button.

- [ ] **Step 6.3: Add a Playwright visual assertion**

In `tests/visual/editor.spec.ts`, add a new test at the bottom of the describe block:

```ts
  test('microphone button is docked inside the chat input wrapper', async ({ page }) => {
    await page.goto('/test');
    await page.getByText(/Blank form/i).first().click();
    await page.getByRole('button', { name: /Google Forms/i }).first().click();
    await page.getByRole('button', { name: /continue|create|start/i }).click();
    await page.waitForURL(/\/test\/edit/);

    const textarea = page.getByPlaceholder('Describe your survey...');
    await expect(textarea).toBeVisible();

    const mic = page.getByTitle(/Start voice input|Stop recording/i);
    await expect(mic).toBeVisible();

    // The mic button's bounding box should sit inside the textarea's bounding box (docked)
    const taBox = await textarea.boundingBox();
    const micBox = await mic.boundingBox();
    expect(taBox).not.toBeNull();
    expect(micBox).not.toBeNull();
    if (taBox && micBox) {
      expect(micBox.x).toBeGreaterThanOrEqual(taBox.x);
      expect(micBox.x + micBox.width).toBeLessThanOrEqual(taBox.x + taBox.width + 2);
      expect(micBox.y).toBeGreaterThanOrEqual(taBox.y - 2);
      expect(micBox.y + micBox.height).toBeLessThanOrEqual(taBox.y + taBox.height + 2);
    }

    await page.screenshot({
      path: 'tests/visual/.artifacts/03-mic-docked.png',
      fullPage: false,
      clip: { x: 1000, y: 700, width: 440, height: 200 },
    });
  });
```

- [ ] **Step 6.4: Run Playwright**

```bash
npm run visual-qa
```

Expected: all four tests pass. Eyeball `03-mic-docked.png` — the mic should sit flush with the right edge of the input textarea, not floating to its left.

- [ ] **Step 6.5: Commit**

```bash
git add src/components/survey/chat/chat-input-area.tsx src/components/survey/chat/voice-input-button.tsx tests/visual/editor.spec.ts
git commit -m "feat(chat): dock microphone button inside chat input wrapper

Previous layout was [mic][textarea][send] — mic floated left of the
input with no visual coupling. New layout docks the mic as an
absolutely-positioned child of the textarea wrapper at the bottom-right,
matching ChatGPT/Gemini/Claude.ai conventions. Tightened the mic
button from h-10 w-10 to h-8 w-8 so it fits the docked footprint
without cramping the send button."
```

---

## Task 7: Light-mode polish pass

**Why:** User said light mode can be "improved significantly further." Concretely, the current `google-forms-light` preset uses `#f0ebf8` (a muted purple wash) as the canvas background, which reads as muddy and Google's real light-mode canvas is colder/cleaner. The shadows are also flat. We tighten three things: background tone, card border contrast, card shadow.

**Files:**
- Modify: `src/lib/survey/presets.ts`

- [ ] **Step 7.1: Update `google-forms-light` preset**

In `src/lib/survey/presets.ts`, replace the `google-forms-light` entry (lines 14-31) with:

```ts
  'google-forms-light': {
    label: 'Google Forms',
    description: 'Clean and professional',
    fontFamily: 'inter',
    cssVars: {
      '--sv-bg': '#f6f8fb',
      '--sv-card-bg': '#ffffff',
      '--sv-card-border': 'rgba(15, 23, 42, 0.08)',
      '--sv-accent': '#673ab7',
      '--sv-text': '#1a1a1f',
      '--sv-text-secondary': '#5a6069',
      '--sv-radius': '8px',
      '--sv-input-bg': '#ffffff',
      '--sv-input-border': 'rgba(15, 23, 42, 0.16)',
      '--sv-card-shadow': '0 1px 2px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(15, 23, 42, 0.04)',
    },
    className: 'survey-light',
  },
```

Key changes:
- Background: `#f0ebf8` (muddy purple) → `#f6f8fb` (clean cool grey)
- Border color: pure black alpha → cool slate alpha for consistency
- Shadow: single layer → two-layer stack with cool-slate tint
- Text: `#202124` → `#1a1a1f` (slightly deeper for contrast on the cooler bg)

- [ ] **Step 7.2: Update `typeform-light` preset for consistency**

Replace the `typeform-light` entry (lines 49-66) with:

```ts
  'typeform-light': {
    label: 'Typeform',
    description: 'Bold and engaging',
    fontFamily: 'dm-sans',
    cssVars: {
      '--sv-bg': '#fafaf7',
      '--sv-card-bg': '#ffffff',
      '--sv-card-border': 'rgba(15, 23, 42, 0.06)',
      '--sv-accent': '#e94560',
      '--sv-text': '#0f172a',
      '--sv-text-secondary': '#64748b',
      '--sv-radius': '16px',
      '--sv-input-bg': '#ffffff',
      '--sv-input-border': 'rgba(15, 23, 42, 0.1)',
      '--sv-card-shadow': '0 2px 10px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
    },
    className: 'survey-light',
  },
```

- [ ] **Step 7.3: Run Playwright with both color modes (visual-only)**

The existing tests use the default color mode. Add a quick coverage test at the bottom of `tests/visual/editor.spec.ts`:

```ts
  test('light mode editor canvas renders with clean cool-grey background', async ({ page }) => {
    await page.goto('/test');
    await page.getByText(/Blank form/i).first().click();
    await page.getByRole('button', { name: /Google Forms/i }).first().click();
    // Flip to light mode in the style dialog if available
    const lightBtn = page.getByRole('button', { name: /^Light$/i });
    if (await lightBtn.isVisible().catch(() => false)) {
      await lightBtn.click();
    }
    await page.getByRole('button', { name: /continue|create|start/i }).click();
    await page.waitForURL(/\/test\/edit/);
    await page.screenshot({
      path: 'tests/visual/.artifacts/04-light-mode.png',
      fullPage: true,
    });
    // Smoke: the survey card should be visible
    await expect(page.locator('.survey-card').first()).toBeVisible();
  });
```

- [ ] **Step 7.4: Run Playwright and eyeball the screenshot**

```bash
npm run visual-qa
```

Expected: all five tests pass. Open `tests/visual/.artifacts/04-light-mode.png` and check:
- Background reads as clean cool grey, not muddy purple
- Card edges are legible against the background
- Shadow has subtle depth rather than flat flushness

If the screenshot looks off, adjust the hex codes in presets.ts and re-run. This is the only inherently subjective task in the plan — iterate until it reads as "clean light mode" visually.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/survey/presets.ts tests/visual/editor.spec.ts
git commit -m "style(presets): polish light-mode palettes for google-forms and typeform

- Google Forms light bg: #f0ebf8 (muddy purple) → #f6f8fb (cool grey)
- Typeform light bg: tightened to near-white warm
- Both: two-layer shadows with cool-slate tint, slate-tinted borders
- Text contrast bumped to read cleaner on the refreshed backgrounds"
```

---

## Task 8: Expand Playwright visual-QA suite (on-demand subagent usage)

**Why:** The user asked for "subagents to constantly check whether there are visual flaws." The practical implementation is: a broad on-demand screenshot suite + a documented workflow where the user (or an orchestrator agent) runs `npm run visual-qa` and then an inspection subagent reviews the artifacts. We do NOT wire this into a cron — that produces noise. This task adds the remaining screen coverage so a subagent has enough to review.

**Files:**
- Modify: `tests/visual/editor.spec.ts`
- Modify: `tests/visual/README.md`

- [ ] **Step 8.1: Add the remaining screen coverage**

In `tests/visual/editor.spec.ts`, add at the bottom of the `describe` block:

```ts
  test('typeform preset editor screenshot', async ({ page }) => {
    await page.goto('/test');
    await page.getByText(/Blank form/i).first().click();
    await page.getByRole('button', { name: /Typeform/i }).first().click();
    await page.getByRole('button', { name: /continue|create|start/i }).click();
    await page.waitForURL(/\/test\/edit/);
    await page.screenshot({
      path: 'tests/visual/.artifacts/05-typeform-editor.png',
      fullPage: true,
    });
  });

  test('editor after adding a short-text question', async ({ page }) => {
    await page.goto('/test');
    await page.getByText(/Blank form/i).first().click();
    await page.getByRole('button', { name: /Google Forms/i }).first().click();
    await page.getByRole('button', { name: /continue|create|start/i }).click();
    await page.waitForURL(/\/test\/edit/);
    await page.getByRole('button', { name: /Add Question/i }).click();
    // Select short text from the element menu — use first match
    await page.getByText(/Short Text/i).first().click();
    await page.screenshot({
      path: 'tests/visual/.artifacts/06-one-question.png',
      fullPage: true,
    });
  });

  test('properties panel render', async ({ page }) => {
    await page.goto('/test');
    await page.getByText(/Blank form/i).first().click();
    await page.getByRole('button', { name: /Google Forms/i }).first().click();
    await page.getByRole('button', { name: /continue|create|start/i }).click();
    await page.waitForURL(/\/test\/edit/);
    await page.getByRole('button', { name: /Add Question/i }).click();
    await page.getByText(/Short Text/i).first().click();
    // Click the new question to select it
    await page.locator('.survey-card').nth(1).click();
    await page.getByRole('tab', { name: /Properties/i }).click().catch(() => {});
    await page.screenshot({
      path: 'tests/visual/.artifacts/07-properties.png',
      fullPage: true,
    });
  });
```

These are low-assertion screenshot tests — they exist so a subagent has artifacts to review, not to gate the build. Each failure should only indicate a hard break (page crash, selector missing).

- [ ] **Step 8.2: Update `tests/visual/README.md` with subagent workflow**

Replace the README content with:

```md
# Visual QA

On-demand Playwright harness for the `/test` editor. Designed to be run by a subagent for visual-flaw review.

## Prerequisites

- Dev server running on `http://localhost:3002`
- `npx playwright install chromium` has been run at least once

## Run

```bash
npm run visual-qa
```

Screenshots land in `tests/visual/.artifacts/` (gitignored). The suite only fails on hard assertions:
- Serif font leaking on survey title
- Template gallery present on blank path
- Proactive greeting missing
- Microphone button not docked inside the input

## Subagent review workflow

To have a subagent scan the screenshots for visual flaws:

1. Run `npm run visual-qa`
2. Dispatch a general-purpose subagent with this prompt:

   > Read every PNG in `tests/visual/.artifacts/`. For each one, report any visual flaws: text overlapping, misaligned elements, font inconsistencies, contrast failures, layout gaps, truncated content, unintended scroll, broken borders. Be concrete with pixel-area references. Under 300 words total.

3. Apply fixes based on the report, re-run `npm run visual-qa`, re-review.

## Adding cases

Each new case should:
1. Navigate to the state you want to verify
2. Make at least one hard assertion (getByRole, expect visible, computed style) OR be explicitly a screenshot-only case
3. Take a full-page screenshot with a numbered filename
```

- [ ] **Step 8.3: Run the full suite**

```bash
npm run visual-qa
```

Expected: all eight tests pass. Seven screenshots in `tests/visual/.artifacts/`.

- [ ] **Step 8.4: Commit**

```bash
git add tests/visual/editor.spec.ts tests/visual/README.md
git commit -m "test(visual): expand Playwright suite + document subagent review flow"
```

---

## Task 9: Final verification and handoff

**Files:** none modified. Pure verification.

- [ ] **Step 9.1: Run lint**

```bash
npm run lint
```

Expected: clean exit. Fix any warnings introduced by the previous tasks — do not leave warnings for Plan B to inherit.

- [ ] **Step 9.2: Run a production build**

```bash
npm run build
```

Expected: build succeeds. This catches type errors, import errors, and SSR issues Playwright can't see.

- [ ] **Step 9.3: Run the full visual-QA suite one more time**

```bash
npm run visual-qa
```

Expected: all tests pass end-to-end.

- [ ] **Step 9.4: Manual eyeball pass**

Visit `http://localhost:3002/test` in a browser:

- Click "Blank form"
- Pick Google Forms, light mode
- Confirm: editor loads, title is sans-serif, no template gallery below, proactive assistant message visible in right panel, mic button docked inside chat input, light-mode background reads clean
- Click "Typeform" preset (via style dialog if reachable from the editor, else restart flow)
- Confirm: Typeform's rounder radius + DM Sans font applies

If anything feels wrong, open an issue comment against the relevant task and iterate in a follow-up commit.

- [ ] **Step 9.5: Summary commit**

```bash
git log --oneline -20
```

Expected: 8 task commits on top of `b681392`. Review the log for coherence, then (if requested) create a PR using `gh pr create`.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ "Times New Roman vibe" → Task 2 (root-cause fix)
- ✅ "Template recommendations on blank survey should be gone" → Task 3 + Task 5
- ✅ "Microphone isn't centralised, isn't symmetric" → Task 6
- ✅ "Proactive AI assistant" → Task 4
- ✅ "Light mode improved" → Task 7
- ✅ "Subagents to check visual flaws" → Tasks 1 + 8
- ✅ Transfer style from Google Forms / Typeform references → Task 7 uses research findings; deeper transfer deferred to Plan B
- ❌ "Voice or text or both respondent answer modes" → **deferred to Plan C** (explicit out-of-scope)
- ❌ "Scalable architecture, accounts, storage, shareable links" → **deferred to Plan D** (explicit out-of-scope)
- ❌ Real Google-Forms-vs-Typeform interaction divergence → **deferred to Plan B** (explicit out-of-scope)

**Type consistency check:** `buildProactiveGreeting` returns `ChatMessage`, which already exists in `@/types/survey`. Store getter/setter names are consistent across Task 4 (`hasSeededProactiveGreeting`, `markProactiveGreetingSeeded`).

**Placeholder scan:** no TODOs, no "add error handling", no "similar to Task N", no missing code blocks.
