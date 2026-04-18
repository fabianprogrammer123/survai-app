/**
 * Headless browser smoke for the AI Inspector drawer.
 *
 *   BASE_URL=http://localhost:3010 TRACE_ID=<uuid> node scripts/smoke-inspector.mjs
 *
 * Verifies:
 *  1. /test/edit?id=<seeded>&inspector=1 loads clean (no unhandled JS errors)
 *  2. The chat-panel kebab menu is rendered
 *  3. Kebab → AI Inspector menu entry appears
 *  4. /api/ai/trace/[id] responds 200 for a known trace id
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const TRACE_ID = process.env.TRACE_ID;
if (!TRACE_ID) {
  console.error('Set TRACE_ID=<uuid> to run the inspector smoke.');
  process.exit(2);
}

const errors = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });

  // Seed a minimal survey into localStorage before navigating to /test/edit.
  // The editor's mount effect reads survai-surveys[id]; we give it a blank
  // survey so notFound stays false.
  await page.goto(`${BASE_URL}/test`, { waitUntil: 'networkidle' });
  const seededId = await page.evaluate(() => {
    const id = 'smoke-survey';
    const survey = {
      id,
      title: 'Smoke survey',
      description: '',
      elements: [],
      settings: {
        theme: 'default',
        showProgressBar: true,
        shuffleQuestions: false,
        confirmationMessage: 'Thanks',
        stylePreset: 'google-forms',
        colorMode: 'dark',
        layoutMode: 'scroll',
        aiContext: { strictness: 'balanced' },
      },
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // local-surveys stores one key per survey: survai-survey-<id>.
    localStorage.setItem(`survai-survey-${id}`, JSON.stringify(survey));
    const index = JSON.parse(localStorage.getItem('survai-surveys-index') || '[]');
    index.push({
      id,
      title: survey.title,
      published: false,
      elementCount: 0,
      stylePreset: 'google-forms',
      colorMode: 'dark',
      createdAt: survey.createdAt,
      updatedAt: survey.updatedAt,
    });
    localStorage.setItem('survai-surveys-index', JSON.stringify(index));
    return id;
  });

  await page.goto(`${BASE_URL}/test/edit?id=${seededId}&inspector=1`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(3000);

  // ── 1. Kebab button present
  const kebabCount = await page.locator('[aria-label="Chat panel menu"]').count();
  if (kebabCount === 0) {
    console.error('FAIL: chat panel kebab not in DOM');
    console.error('labels on page:', await page.locator('button[aria-label]').evaluateAll(els => els.map(e => e.getAttribute('aria-label'))));
    process.exit(1);
  }
  console.log('OK: kebab present (count =', kebabCount, ')');

  // ── 2. Click kebab → AI Inspector item visible
  await page.locator('[aria-label="Chat panel menu"]').first().click();
  await page.waitForTimeout(600);
  // The menu popup is rendered in a portal; match by any visible element that
  // contains the label text.
  const inspectorCount = await page
    .locator('[data-slot="dropdown-menu-content"] >> text=AI Inspector')
    .count();
  if (inspectorCount === 0) {
    // Fall back to a less-strict search
    const anyMatch = await page.getByText('AI Inspector').count();
    if (anyMatch === 0) {
      console.error('FAIL: AI Inspector menu item not found after kebab click');
      process.exit(1);
    }
  }
  console.log('OK: AI Inspector menu item rendered in kebab dropdown');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ── 3. GET /api/ai/trace/[id] is reachable + 200
  const apiStatus = await page.evaluate(async (id) => {
    const r = await fetch(`/api/ai/trace/${id}`);
    return { ok: r.ok, status: r.status };
  }, TRACE_ID);
  if (!apiStatus.ok) {
    console.error('FAIL: /api/ai/trace/[id] returned', apiStatus.status);
    process.exit(1);
  }
  console.log('OK: /api/ai/trace/[id] returned 200');

  // ── 4. Screenshot for the report
  await page.screenshot({ path: '/tmp/ai-inspector-smoke.png', fullPage: false });
  console.log('Screenshot: /tmp/ai-inspector-smoke.png');

  if (errors.length > 0) {
    console.error('JS errors during load:');
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log('OK: no JS errors');
} finally {
  await browser.close();
}
