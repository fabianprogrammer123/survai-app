// Smoke test for Stream B (voice-answering shareable link).
//
// Verifies the anonymous /s/:id landing at both desktop and mobile 375px
// viewports, confirms the two CTAs render conditionally on agent_id,
// exercises the "Answer by typing" fallback end-to-end, and takes
// screenshots for the completion report.
//
// Run:  BASE_URL=http://localhost:3011 node scripts/smoke-voice-link.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3011';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || 'tmp/smoke';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const SURVEY_WITH_AGENT = '5009c73a-01b0-47b5-bbed-79c4c7cec6f7';
const SURVEY_WITHOUT_AGENT = 'be57e4df-a4eb-4a68-abd3-a8e45d13e1a1';

const browser = await chromium.launch({ headless: true });
const errors = [];

async function step(label, fn) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`  ✓ ${label}  (${Date.now() - t0}ms)`);
  } catch (e) {
    console.log(`  ✗ ${label}  ${e?.message || e}`);
    errors.push(`${label}: ${e?.message || e}`);
  }
}

async function makePage(viewport) {
  const ctx = await browser.newContext({
    viewport,
    permissions: [], // deny microphone by default — forces the mic-denied path if tested
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // Filter some benign dev-only noise
      const t = msg.text();
      if (t.includes('Download the React DevTools')) return;
      errors.push('[console:error] ' + t);
    }
  });
  return { ctx, page };
}

console.log(`→ ${BASE}`);

// ── Desktop: survey with voice agent ─────────────────────────────────
{
  const { ctx, page } = await makePage({ width: 1280, height: 800 });

  await step('desktop · /s/:id-with-agent loads', async () => {
    await page.goto(`${BASE}/s/${SURVEY_WITH_AGENT}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('[data-anon-title]', { timeout: 15000 });
  });

  await step('desktop · both CTAs visible when agent exists', async () => {
    const voice = await page.locator('[data-anon-cta="voice"]').count();
    const typing = await page.locator('[data-anon-cta="typing"]').count();
    if (voice !== 1) throw new Error(`expected 1 voice CTA, got ${voice}`);
    if (typing !== 1) throw new Error(`expected 1 typing CTA, got ${typing}`);
  });

  await step('desktop · landing screenshot', async () => {
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/desktop-landing.png`,
      fullPage: true,
    });
  });

  await step('desktop · typing CTA advances to SurveyForm', async () => {
    await page.locator('[data-anon-cta="typing"]').click();
    await page.waitForSelector('[data-survey-form-response]', { timeout: 5000 });
  });

  await step('desktop · SurveyForm screenshot', async () => {
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/desktop-typing.png`,
      fullPage: true,
    });
  });

  await ctx.close();
}

// ── Mobile 375px: survey with voice agent ────────────────────────────
{
  const { ctx, page } = await makePage({ width: 375, height: 800 });

  await step('mobile375 · landing renders, no horizontal overflow', async () => {
    await page.goto(`${BASE}/s/${SURVEY_WITH_AGENT}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('[data-anon-title]', { timeout: 15000 });
    // Check no element overflows the viewport horizontally.
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    if (overflow) throw new Error('horizontal overflow on 375px viewport');
  });

  await step('mobile375 · voice CTA meets 44px tap target', async () => {
    const box = await page.locator('[data-anon-cta="voice"]').boundingBox();
    if (!box) throw new Error('voice CTA missing');
    if (box.height < 44) throw new Error(`voice CTA height ${box.height} < 44px`);
  });

  await step('mobile375 · landing screenshot', async () => {
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/mobile-landing.png`,
      fullPage: true,
    });
  });

  await ctx.close();
}

// ── Agent-less survey: voice CTA should not render ───────────────────
{
  const { ctx, page } = await makePage({ width: 1280, height: 800 });

  await step('no-agent survey · voice CTA hidden, typing CTA visible', async () => {
    await page.goto(`${BASE}/s/${SURVEY_WITHOUT_AGENT}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('[data-anon-title]', { timeout: 15000 });
    const voice = await page.locator('[data-anon-cta="voice"]').count();
    const typing = await page.locator('[data-anon-cta="typing"]').count();
    if (voice !== 0) throw new Error(`expected no voice CTA, got ${voice}`);
    if (typing !== 1) throw new Error(`expected 1 typing CTA, got ${typing}`);
  });

  await step('no-agent survey · screenshot', async () => {
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/no-agent-landing.png`,
      fullPage: true,
    });
  });

  await ctx.close();
}

// ── Voice click → signed-url fetch (mic-denied stub path) ────────────
{
  const { ctx, page } = await makePage({ width: 1280, height: 800 });

  let signedUrlHit = false;
  page.on('request', (req) => {
    if (req.url().includes('/api/elevenlabs/signed-url')) signedUrlHit = true;
  });

  await step('voice CTA fetches signed-url', async () => {
    await page.goto(`${BASE}/s/${SURVEY_WITH_AGENT}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('[data-anon-cta="voice"]', { timeout: 15000 });
    await page.locator('[data-anon-cta="voice"]').click();
    await page.waitForTimeout(1500);
    if (!signedUrlHit) throw new Error('signed-url endpoint was not called');
  });

  // Voice session surface should mount (connecting state). In headless
  // Chromium with no mic, the SDK will eventually hit the error path,
  // but the component's surface should render at least briefly.
  await step('voice session surface mounts', async () => {
    const mounted = await page
      .locator('[data-voice-session]')
      .count();
    if (mounted !== 1) throw new Error('voice session surface did not mount');
  });

  await ctx.close();
}

await browser.close();

console.log('');
if (errors.length) {
  console.log(`✗ ${errors.length} error(s):`);
  errors.forEach((e) => console.log(`  · ${e}`));
  process.exit(1);
} else {
  console.log('✓ all smoke steps green');
}
