import { test, expect } from '@playwright/test';

test.describe('Game Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('text=SOLO RACE').click();
    await page.locator('.char-card').first().click();
    await page.locator('.circuit-card').first().click();
    await expect(page.locator('#hud')).toBeVisible({ timeout: 10000 });
    // Wait for countdown
    await page.waitForTimeout(5000);
  });

  test('should accelerate with Z key', async ({ page }) => {
    const initialSpeed = await page.locator('#hud-speed').textContent();
    await page.keyboard.down('KeyZ');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyZ');
    const newSpeed = await page.locator('#hud-speed').textContent();
    expect(parseInt(newSpeed)).toBeGreaterThan(parseInt(initialSpeed));
  });

  test('should open pause menu with Escape', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-menu')).toBeVisible({ timeout: 2000 });
  });

  test('should resume with Escape after pause', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-menu')).not.toBeVisible({ timeout: 2000 });
  });
});
