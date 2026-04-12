# Visual QA

On-demand Playwright harness for the `/test` editor.

## Prerequisites

- Dev server running on `http://localhost:3003`
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
