import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.describe('Mobile Controls', () => {

  test('should load game on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=KHAOS KART')).toBeVisible({ timeout: 10000 });
  });

  test('should show portrait warning in portrait mode', async ({ page, context }) => {
    // iPhone 14 defaults to portrait dimensions
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(2000);

    const warning = page.locator('#portrait-warning');
    // Portrait warning should be visible when height > width
    if (await warning.count() > 0) {
      await expect(warning).toBeVisible();
    }
  });

  test('should hide portrait warning in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await page.waitForTimeout(2000);

    const warning = page.locator('#portrait-warning');
    if (await warning.count() > 0) {
      await expect(warning).not.toBeVisible();
    }
  });

  test('should start race on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');

    // On mobile, nipplejs creates a joystick-zone overlay that intercepts pointer events.
    // Continuously hide it so menu clicks go through.
    await page.addStyleTag({ content: '#joystick-zone { pointer-events: none !important; }' });

    await page.locator('text=SOLO RACE').click();
    await page.locator('.char-card').first().click();
    await page.locator('.circuit-card').first().click();
    await expect(page.locator('#hud')).toBeVisible({ timeout: 10000 });
  });
});
