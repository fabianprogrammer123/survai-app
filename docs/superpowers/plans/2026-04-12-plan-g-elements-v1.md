# Plan G — Element Library v1 (Simple Elements + AI Context)

**Goal:** Ship 5 items that follow the existing element pattern or extend the survey settings: Survey-level AI context, Linear Scale discrete/continuous variants, NPS element, Slider/Range element, real File Upload (local data-URI storage).

**Base:** main at `8598290`. Branch `feat/plan-g-elements`.

**Tech stack unchanged:** Next.js 16, React 19, Tailwind 4, shadcn/ui, Zustand, Zod, Playwright.

**Architectural principle:** every new element follows the same pattern — 8 touch points. Consistency matters more than cleverness.

## The 8-touch-point pattern for a new element type

Whenever adding an element type, touch these files in order:
1. **`src/types/survey.ts`** — add the element's TypeScript interface to the discriminated union
2. **`src/lib/ai/schema.ts`** — add the Zod schema variant
3. **`src/lib/ai/catalog-manifest.ts`** — add entry to `typeProperties` and `typeConstraints` (if needed), ensures the AI knows what it can emit
4. **`src/lib/ai/prompts.ts`** — (if needed) add a one-line hint about when to use this element
5. **`src/lib/survey/catalog.ts`** — add `CATALOG` entry (label, icon, description, category, default)
6. **`src/components/survey/elements/[name].tsx`** — new renderer (editor + preview modes)
7. **`src/components/survey/elements/element-renderer.tsx`** — register in the type→renderer map
8. **`src/components/survey/editor/properties-panel.tsx`** — add `buildTypeConversion` case + (if needed) type-specific property editor section

Playwright test for every element: create the type via AI chat OR via Add Question menu, verify it renders in editor mode, verify it renders in response mode.

---

## Task G1 — Survey-level AI context field

**Why:** User asked for a hidden field where survey creators describe the goal + strictness for the AI. This feeds into the AI chat and (later) voice interviews.

**Files:**
- Modify: `src/types/survey.ts` — extend `SurveySettings` with `aiContext?: { goal?: string; strictness?: 'strict' | 'balanced' | 'open' }`
- Modify: `src/lib/ai/schema.ts` — extend `nullablePartialSettingsSchema` with `aiContext`
- Modify: `src/lib/ai/prompts.ts` — when the survey's `settings.aiContext` is set, include it in the system prompt as "Survey goal: {goal}. Interview strictness: {strictness} ({description}).". Descriptions:
  - `strict`: "Stay on-script. Ask only the defined questions verbatim. Do not probe."
  - `balanced`: "Ask the defined questions but probe for clarification when answers are vague."
  - `open`: "Use the questions as a seed. Follow interesting threads. Extract deep insights."
- Modify: `src/components/survey/editor/properties-panel.tsx` — when NO element is selected (survey-level settings view), add a new "AI Context" section with a textarea for `goal` and a segmented control for `strictness`.
- Modify: `src/types/survey.ts` — add `DEFAULT_SETTINGS.aiContext = { strictness: 'balanced' }` (optional goal, sensible strictness default)

**Playwright test:** set AI context via properties panel, navigate away and back, assert persistence.

**Commit G1:**
```
feat(ai): survey-level AI context (goal + strictness) feeds prompt building

Hidden survey configuration that shapes AI behavior during chat
generation and voice interviews. Three strictness levels determine
how closely the AI follows the defined questions vs probes deeper:
strict (stay on-script), balanced (probe for clarification), open
(follow interesting threads). Exposed in properties panel when no
element is selected.
```

---

## Task G2 — Linear Scale: discrete vs continuous variants

**Why:** User wants LinearScale to have two modes — the current radio-dots layout OR a continuous slider.

**Files:**
- Modify: `src/types/survey.ts` — extend `LinearScaleElement` with `mode?: 'discrete' | 'continuous'` (default 'discrete' for backward compat)
- Modify: `src/lib/ai/schema.ts` — add `mode` field
- Modify: `src/lib/ai/catalog-manifest.ts` — add `mode` to LinearScale's typeProperties
- Modify: `src/components/survey/elements/linear-scale.tsx` — branch render on mode. Continuous mode uses `<input type="range">` with a dynamic value label above the thumb. Keeps min/max/step support. Visual labels (minLabel/maxLabel) stay on the left/right in both modes.
- Modify: `src/components/survey/editor/properties-panel.tsx` — add a segmented control for LinearScale `mode` in the type-specific properties section

**Playwright test:** add a LinearScale, switch to continuous, verify a slider input renders; switch back to discrete, verify radio buttons render.

**Commit G2:**
```
feat(elements): Linear Scale supports discrete or continuous modes

Default discrete mode preserved (radio dots, Plan A layout). New
continuous mode renders HTML input[type=range] with a live value
label above the thumb. minLabel/maxLabel flank in both modes. Schema
backward-compatible (mode is optional, defaults to discrete).
```

---

## Task G3 — NPS element (Net Promoter Score, 0-10 colored buttons)

**Why:** Industry-standard survey element that deserves a dedicated type.

**Files (full 8 touch points):**
- New `src/components/survey/elements/nps.tsx` — renders 11 buttons (0 through 10) with colored zones:
  - 0-6 red (Detractor)
  - 7-8 yellow (Passive)
  - 9-10 green (Promoter)
  Selected state shows the button filled with its zone color.
- Optional labels "Not likely" (left, under 0) and "Very likely" (right, under 10).
- Default `minLabel: 'Not likely'`, `maxLabel: 'Very likely'`.

Types, schema, catalog, manifest, renderer registration, properties panel.

**Commit G3:**
```
feat(elements): add NPS (Net Promoter Score) question type

11 buttons 0-10 with Detractor/Passive/Promoter zones colored
red/yellow/green. Standard "How likely are you to recommend"
question pattern. Full catalog + AI schema + prompts integration
so the AI can emit NPS questions when appropriate.
```

---

## Task G4 — Slider/Range element (free-form 0-100)

**Why:** Distinct from LinearScale and NPS — meant for percentages and ranges where 0-100 is the natural scale.

**Files (full 8 touch points):**
- New `src/components/survey/elements/slider.tsx` — `<input type="range">` with configurable min/max/step, large value readout.
- Defaults: min=0, max=100, step=1.
- Optional `unit?: string` (e.g., "%", "hours").

**Commit G4:**
```
feat(elements): add Slider/Range question type for numeric 0-100 input

Distinct from LinearScale (categorical 1-N) and NPS (fixed 0-10):
Slider is for free-form numeric input on a range, like "what
percent of your week is spent in meetings?". Configurable min/max/
step/unit. Live value readout above the thumb.
```

---

## Task G5 — File Upload: real implementation (local data URIs)

**Why:** Placeholder was hidden in Plan B. User wants it working. Real cloud storage needs Plan D, but a local data-URI implementation works for demo/respondent flows.

**Files:**
- Modify: `src/components/survey/elements/file-upload.tsx` — replace placeholder with real `<input type="file">`, FileReader → base64 data URI stored in response value. Display a list of attached files with name/size.
- Modify: `src/lib/survey/catalog.ts` — flip `hidden: true` → `hidden: false` on file_upload entry
- Modify: `src/lib/ai/catalog-manifest.ts` — un-filter file_upload (remove the `.filter(c => !c.hidden)` gate from manifest-building if that's what hides it in the AI path — actually we want the AI to still be able to emit file_upload, so confirm the manifest INCLUDES it now)
- Modify: `src/components/survey/response/survey-form.tsx` — handle value serialization for file_upload
- Value shape: `File[]` during client state, `{ name, type, size, dataUrl }[]` when persisted to response

**Constraint:** max 2 MB per file (local constraint — the base64 data URIs get big), enforced client-side with an error toast.

**Commit G5:**
```
feat(elements): file upload works end-to-end with local data-URI storage

Previously a placeholder "File upload coming soon". Now a real
input[type=file] with multi-file support. Files are base64-encoded
as data URIs in respondent state. Max 2MB/file enforced client-side
(local constraint — real cloud storage lands with Plan D Supabase).
Unhidden from Add Question menu and from AI catalog manifest.
```

---

## Final verification

- `npm run lint` — must stay at or below 57
- `npm run build` — must compile
- `npm run visual-qa` — all tests (29 existing + new per task) pass

## Execution notes

- **Commit granularity:** 5 separate commits (G1, G2, G3, G4, G5). Don't combine.
- **Dispatch strategy:** two subagents — one for G1 + G5 (independent, small), one for G2 + G3 + G4 (share numeric-element pattern).
- **Read files before editing.** Every time.
- **Don't break any of the 29 existing Playwright tests.**
- **If a subagent gets stuck on a type-check or architecture question, it reports BLOCKED and we coordinate rather than improvising.**

## Next plans on deck

- **Plan H** — Matrix/Grid + Likert + Ranking + Image Choice
- **Plan I** — Skip Logic + Progress bar + Save & Continue + Hidden URL params
