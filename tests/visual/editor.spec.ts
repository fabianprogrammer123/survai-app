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
});
