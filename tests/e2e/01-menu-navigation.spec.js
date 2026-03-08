import { test, expect } from '@playwright/test';

test.describe('Menu Navigation', () => {
  test('should load game and show main menu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=KHAOS KART')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=SOLO RACE')).toBeVisible();
  });

  test('should navigate to character select', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=SOLO RACE').click();
    await expect(page.locator('text=SELECT CHARACTER')).toBeVisible({ timeout: 5000 });
  });

  test('should select character and navigate to circuit select', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=SOLO RACE').click();
    await expect(page.locator('text=SELECT CHARACTER')).toBeVisible({ timeout: 5000 });

    // Click first character card
    await page.locator('.char-card').first().click();
    await expect(page.locator('text=SELECT CIRCUIT')).toBeVisible({ timeout: 5000 });
  });

  test('should select circuit and start race', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=SOLO RACE').click();
    await page.locator('.char-card').first().click();
    await page.locator('.circuit-card').first().click();

    // Should see HUD elements
    await expect(page.locator('#hud')).toBeVisible({ timeout: 10000 });
  });
});
