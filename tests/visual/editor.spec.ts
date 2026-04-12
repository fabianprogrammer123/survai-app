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
    expect(fontFamily.toLowerCase()).not.toMatch(/times|(?<!sans-)serif\b/);

    // The inline "Start with a template" block must not render in the blank-survey editor
    await expect(page.getByText(/Start with a template/i)).toHaveCount(0);
    await expect(page.getByText(/Pick a starting point/i)).toHaveCount(0);

    await page.screenshot({
      path: 'tests/visual/.artifacts/02-blank-editor.png',
      fullPage: true,
    });
  });

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
    // Click the new question to select it (last card in the list)
    await page.locator('.survey-card').last().click({ timeout: 5000 }).catch(() => {});
    await page.getByRole('tab', { name: /Properties/i }).click({ timeout: 2000 }).catch(() => {});
    await page.screenshot({
      path: 'tests/visual/.artifacts/07-properties.png',
      fullPage: true,
    });
  });
});
