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

// The voice CTA calls navigator.mediaDevices.getUserMedia before the
// signed-url fetch, so we need a fake media device + granted mic perms.
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
});
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

async function makePage(viewport, { grantMic = false } = {}) {
  const ctx = await browser.newContext({
    viewport,
    permissions: grantMic ? ['microphone'] : [],
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

// ── Mic denied → returns to welcome with error ───────────────────────
//
// This covers the "user denies mic permission" path by stubbing
// getUserMedia to reject synchronously. We *can't* reliably smoke-test
// the happy voice path headlessly — playwright's fake media stream
// doesn't always resolve getUserMedia, and the ElevenLabs SDK requires
// a real audio pipeline. The happy path is verified manually in a real
// browser against a published survey with an agent.
{
  const { ctx, page } = await makePage({ width: 1280, height: 800 });

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () =>
          Promise.reject(
            Object.assign(new Error('Permission denied'), {
              name: 'NotAllowedError',
            })
          ),
      },
      configurable: true,
    });
  });

  await step('mic-denied click surfaces clear error on welcome', async () => {
    await page.goto(`${BASE}/s/${SURVEY_WITH_AGENT}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('[data-anon-cta="voice"]', { timeout: 15000 });
    await page.locator('[data-anon-cta="voice"]').click();
    await page.waitForSelector('[data-anon-error]', { timeout: 5000 });
    const msg = await page.locator('[data-anon-error]').textContent();
    if (!msg || !/microphone/i.test(msg)) {
      throw new Error(`expected microphone error, got: ${msg}`);
    }
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
