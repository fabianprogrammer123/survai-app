# Roadmap: Element Library Expansion + Polish

> **Status:** Draft, 2026-04-12. Live document — update as plans ship.
> **Current main HEAD:** `de3caab` (pushed to GitHub)

## Overview

User walkthrough surfaced ~18 items across four categories. Cannot be shipped in one plan; would become a 60-task wishlist. Sequenced below with dependencies called out. Each plan listed here produces working, reviewable software on its own and ships to main between plans.

## Dependency graph

```
┌───────────────────────────────────────┐
│ Plan F — Polish + page-break bug fix  │ ← START HERE
│ (small, user-visible wins)            │
└───────────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Plan G — Simple new elements          │
│ (Slider, NPS, LinearScale continuous, │
│  hidden AI context)                   │
└───────────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Plan H — Complex new elements         │
│ (Matrix, Likert, Ranking, Image       │
│  Choice)                              │
└───────────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Plan I — Flow features                │
│ (Skip Logic, Progress bar + Save,     │
│  Hidden URL params)                   │
└───────────────────────────────────────┘

                  ▲ can run in parallel
                  │
┌───────────────────────────────────────┐
│ Plan D1/D2 — Backend (parallel agent) │
│ Unblocks: real File Upload,           │
│ true Save & Continue, URL params      │
│ via logged-in user                    │
└───────────────────────────────────────┘
```

## Plan F — Polish + page-break bug fix

**Scope:** The 6 items the user called out during walkthrough + the critical page-break bug.

| # | Issue | Severity | Scope |
|---|---|---|---|
| F1 | Mobile: Blank form card too big, eats viewport | Medium | `template-row.tsx` |
| F2 | Mobile: AI chat drawer takes too much space | Medium | `right-panel.tsx` or `editor/page.tsx` |
| F3 | Desktop: Recent forms shows double-preview illusion (title appears twice — inside mini-preview AND in footer) | Medium | `survey-card.tsx` + `mini-form-preview.tsx` |
| F4 | Desktop: "Start a new form" background contrast too subtle vs page-bg | Small | `test/page.tsx` |
| F5 | Dark mode: Title/description inputs have lighter-tone background differing from card bg | Small | `survey-header-card.tsx` |
| F6 | Recent forms card: render actual form preview (reuse SurveyForm at mini scale) instead of synthetic icon lines | Medium | New component, replace `mini-form-preview.tsx` |
| F7 | BUG: Page breaks don't paginate — survey scrolls through them | High | `survey-form.tsx` + response rendering logic |

**Estimated effort:** 7 commits, ~1 session. Low architectural risk, all isolated to existing files.

## Plan G — Simple new elements

**Scope:** Four new capabilities that fit the existing element pattern.

| # | Feature | Approach |
|---|---|---|
| G1 | Linear Scale — add `mode: 'discrete' \| 'continuous'` variant | Extend `LinearScaleElement` type; continuous mode renders HTML `<input type="range">`. Keep existing discrete RadioGroup default. |
| G2 | NPS element (0-10 score with Detractor/Passive/Promoter color bands) | New `nps` element type; renders 11 buttons colored red/yellow/green. |
| G3 | Slider / Range element (distinct from Linear Scale) | New `slider` element type; explicitly continuous, with min/max/step labels. Unlike NPS or Linear Scale, this is free-form 0-100% numeric. |
| G4 | Hidden "AI context" field on survey | Add `settings.aiContext: { goal?, strictness: 'strict' \| 'balanced' \| 'open' }`. Not rendered to respondents. Fed into AI prompts when generating questions or running voice interviews. |

**Architectural touches:** `types/survey.ts`, `lib/ai/schema.ts`, `lib/ai/catalog-manifest.ts`, `lib/ai/prompts.ts`, `lib/survey/catalog.ts`, 3 new renderers, properties-panel branches. Same pattern as existing elements — low risk once the first one lands.

**Estimated effort:** 4 substantial commits, ~1-2 sessions.

## Plan H — Complex new elements

**Scope:** Elements with 2D structure or media handling — deeper architectural work.

| # | Feature | Approach |
|---|---|---|
| H1 | Ranking (drag-and-drop reorder) | New `ranking` element type. Reuse `@dnd-kit/sortable` already in deps. Value is ordered array of option IDs. |
| H2 | Likert Scale (standardized Strongly Disagree → Strongly Agree for multiple statements) | Specialization of the Matrix Single Choice. Ship as `likert` type with a fixed 5 or 7-point Likert options preset. |
| H3 | Matrix / Grid (Single Choice) | 2D: rows (statements) × columns (scale). One radio per row. |
| H4 | Matrix / Grid (Multiple Choice) | 2D: rows × columns. Checkbox per cell. |
| H5 | Image Choice | Options are images instead of text. Requires image upload — uses base64 data URIs on client OR Supabase Storage if Plan D is live. |

**Architectural touches:** `SurveyElement` union grows significantly; Zod schema gets nested-object shapes; properties panel needs specialized row/column editors. Higher review burden.

**Estimated effort:** 5 substantial commits, ~2-3 sessions.

## Plan I — Flow features

**Scope:** Features that change *how* the survey flows, not just what elements exist.

| # | Feature | Approach |
|---|---|---|
| I1 | Skip Logic ("If answer is A, go to question 3") | New `conditions` field on elements: `conditions: { if: [{ elementId, operator, value }], goto: elementId \| 'end' }`. Runtime branch evaluation in `SurveyForm`. Major UI work in properties panel (visual rule builder). |
| I2 | Progress bar + "Save & Continue" | Progress bar on respondent view counting answered/total. Save & Continue needs either localStorage-side persistence (easy) or backend session (real). Start localStorage v1; upgrade once Plan D lands. |
| I3 | Hidden fields via URL parameters | Parse `?param=value` on respondent page load; store in response metadata alongside submitted answers. |

**Estimated effort:** 4-6 commits, ~2 sessions.

## Plan D (parallel) — Backend

Ongoing in `.worktrees/backend-d1-d2` per the earlier prompt. Unlocks:
- Real File Upload (currently unimplemented, hidden from Add menu)
- Real Save & Continue (currently localStorage-only)
- URL-param hidden fields persisted properly
- Multi-device survey access
- Real response collection

Does NOT block Plans F / G / H / I — those all work on localStorage.

## Sequence and decision points

1. **Ship Plan F now** — all visible polish wins + the page-break bug. One session, ~7 commits, merge to main. User gets immediate value.
2. **After F merges:** brief decision — does user want Plan G (simple elements) next, or jump to Plan I (flow features)? G is lower-risk and compounds into H nicely; I is more user-visible ("can build a real branching survey now") but bigger lift.
3. **Plan H:** only after G lands — H reuses patterns from G and would be chaotic to build in parallel.
4. **Plan I:** can ship independently of G/H but benefits from having more elements to branch on.

## What's NOT in this roadmap

Deferred for later consideration:
- Voice / phone survey polish beyond what already works via ElevenLabs
- Real-time collaboration (multi-cursor editing)
- Templates marketplace / sharing
- Export to external services (Google Sheets, Notion, Slack webhooks)
- Analytics deep-dive (cohort, segment, funnel)
- Custom branding / white-label
- A/B testing different survey versions

These live in a hypothetical Plan J+ once the tool reaches product-market fit signal.

## Current state for reference

- `main` HEAD: `de3caab` on GitHub
- 39 commits above original MVP
- 27 Playwright tests passing
- 57 lint problems (below 58 baseline)
- Build clean
- Worktree: `.worktrees/test-ux-polish` on branch `feat/mobile-responsive` (now merged)
