import { test, expect } from '@playwright/test';

test.describe('Local Multiplayer', () => {
  test('should show 2-player option in menu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=LOCAL 2 PLAYERS')).toBeVisible();
  });

  test('should allow 2-player character selection', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=LOCAL 2 PLAYERS').click();
    await expect(page.locator('text=PLAYER 1')).toBeVisible({ timeout: 5000 });

    // Select first character for P1
    await page.locator('.char-card').first().click();
    await expect(page.locator('text=PLAYER 2')).toBeVisible({ timeout: 5000 });

    // Select second character for P2
    await page.locator('.char-card').nth(1).click();
    await expect(page.locator('text=SELECT CIRCUIT')).toBeVisible({ timeout: 5000 });
  });

  test('should start 2-player race with split screen', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=LOCAL 2 PLAYERS').click();
    await page.locator('.char-card').first().click();
    await page.locator('.char-card').nth(1).click();
    await page.locator('.circuit-card').first().click();

    await expect(page.locator('#hud')).toBeVisible({ timeout: 10000 });
  });
});
