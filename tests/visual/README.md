# Visual QA

On-demand Playwright harness for the `/test` editor. Designed to be run by a subagent for visual-flaw review.

## Prerequisites

- Dev server running on `http://localhost:3003`
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
