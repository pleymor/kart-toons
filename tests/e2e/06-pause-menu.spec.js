import { test, expect } from '@playwright/test';

test.describe('Pause Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('text=SOLO RACE').click();
    await page.locator('#select-btn').click();
    await page.locator('.circuit-card').first().click();
    await expect(page.locator('#hud')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should open pause menu', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-menu')).toBeVisible();
    await expect(page.locator('text=RESUME')).toBeVisible();
  });

  test('should have settings sections', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-section="controls"]')).toBeVisible();
    await expect(page.locator('[data-section="audio"]')).toBeVisible();
    await expect(page.locator('[data-section="video"]')).toBeVisible();
    await expect(page.locator('[data-section="game"]')).toBeVisible();
    await expect(page.locator('[data-section="accessibility"]')).toBeVisible();
  });

  test('should expand audio section', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.locator('[data-section="audio"]').click();
    await expect(page.locator('#section-audio')).toHaveClass(/open/);
  });

  test('should change audio volume', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.locator('[data-section="audio"]').click();

    const slider = page.locator('input[data-key="masterVolume"]');
    await expect(slider).toBeVisible();
    await slider.fill('0.5');
  });

  test('should resume game', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.locator('#resume-btn').click();
    await expect(page.locator('#pause-menu')).not.toBeVisible();
  });
});
