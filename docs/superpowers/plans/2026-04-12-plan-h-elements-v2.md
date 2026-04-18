# Plan H — Element Library v2 (Complex Elements)

**Goal:** Ship 5 elements that require 2D structure or media handling: Matrix Single Choice, Matrix Multi Choice, Likert Scale (matrix preset), Ranking (DnD), Image Choice.

**Base:** main at `3ff97c0`. Branch `feat/plan-h-elements`.

**Architectural principle:** Matrix is the architectural foundation — Likert is a Matrix Single preset with pre-canned scale options. Image Choice reuses Multiple Choice's option system with data-URI option media. Ranking reuses `@dnd-kit/sortable` already in the project.

## Dependency-ordered implementation

1. **H3 — Matrix Single Choice FIRST** — establishes 2D rendering, store value shape `{ [rowId]: columnValue }`, properties panel row/column editor, Zod schema for nested arrays.
2. **H2 — Likert Scale SECOND** — specialization of H3 with fixed 5 or 7-point Likert scale options (Strongly Disagree → Strongly Agree). Reuses Matrix Single renderer with a "likert: true" flag or preset.
3. **H4 — Matrix Multi Choice THIRD** — similar to H3 but value is `{ [rowId]: columnValue[] }`, checkboxes per cell.
4. **H1 — Ranking** — DnD reorderable list, value is ordered array of option IDs. Uses @dnd-kit (already in deps).
5. **H5 — Image Choice** — variant of Multiple Choice where each option has a `label: string` + `imageDataUrl?: string`. Reuses file-reader logic from Plan G's File Upload.

## Element schema additions

### MatrixSingleElement
```ts
export interface MatrixSingleElement extends BaseElement {
  type: 'matrix_single';
  rows: string[];       // statements, e.g. "The onboarding was clear"
  columns: string[];    // scale, e.g. ["Poor", "Fair", "Good", "Excellent"]
}
```
**Value shape at runtime:** `Record<string, string>` where key is row index (or row text), value is the selected column text.

### MatrixMultiElement
```ts
export interface MatrixMultiElement extends BaseElement {
  type: 'matrix_multi';
  rows: string[];
  columns: string[];
}
```
**Value shape:** `Record<string, string[]>` — each row has an array of selected columns.

### LikertElement
```ts
export interface LikertElement extends BaseElement {
  type: 'likert';
  rows: string[];
  /** 5 = standard Likert, 7 = extended. 3 = simple. */
  scale: 3 | 5 | 7;
}
```
Under the hood uses the same Matrix Single rendering but with auto-generated column labels from the scale.

### RankingElement
```ts
export interface RankingElement extends BaseElement {
  type: 'ranking';
  items: string[];
}
```
**Value shape:** `string[]` — ordered list of items as user ranked them.

### ImageChoiceElement
```ts
export interface ImageChoiceElement extends BaseElement {
  type: 'image_choice';
  options: Array<{
    label: string;
    imageDataUrl?: string;  // base64 data URI
  }>;
  multiSelect?: boolean;  // false = single choice, true = multi
}
```
**Value shape:** `string` (single) or `string[]` (multi) — the label(s) of selected options.

## Touch points (per element, same 8-point pattern as Plan G)

1. `src/types/survey.ts` — add to discriminated union
2. `src/lib/ai/schema.ts` — Zod schema
3. `src/lib/ai/catalog-manifest.ts` — typeProperties + constraints
4. `src/lib/ai/prompts.ts` — one-line usage hint
5. `src/lib/survey/catalog.ts` — CATALOG entry with icon + default
6. `src/components/survey/elements/[name].tsx` — new renderer
7. `src/components/survey/elements/element-renderer.tsx` — register
8. `src/components/survey/editor/properties-panel.tsx` — buildTypeConversion case + type-specific editor

## Dispatch strategy

**Two subagents, dependency-sequenced:**

**Subagent A (serial):** H3 Matrix Single → H2 Likert → H4 Matrix Multi. Because H2 and H4 depend on H3's rendering pattern existing, and they share a row/column properties editor.

**Subagent B (parallel with A):** H1 Ranking + H5 Image Choice. Independent from Matrix work — Ranking uses DnD, Image Choice uses the file-upload reader.

They meet on shared files (types/survey.ts, schema.ts, catalog-manifest.ts, catalog.ts, element-renderer.tsx, properties-panel.tsx) but each edits disjoint sections. Same pattern that worked in Plan G.

## Commits (5 total, one per element)

1. `feat(elements): add Matrix Single Choice question type`
2. `feat(elements): add Likert Scale question type (Matrix Single preset)`
3. `feat(elements): add Matrix Multiple Choice question type`
4. `feat(elements): add Ranking question type with drag-and-drop reordering`
5. `feat(elements): add Image Choice question type with data-URI option media`

## Final verification

- `npm run lint` — must stay at or below 57
- `npm run build` — must compile
- `npm run visual-qa` — all tests pass (35 existing + 5 new = 40+)

## After Plan H

**Plan I — Flow features:**
- Skip Logic (conditional navigation between elements)
- Progress bar + Save & Continue (localStorage v1)
- Hidden Fields / URL parameters

These are architecturally different (flow, not elements) — will need its own careful plan.
