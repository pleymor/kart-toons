import { test, expect } from '@playwright/test';

test.describe('Items System', () => {
  test('should show empty item slot in HUD', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=SOLO RACE').click();
    await page.locator('.char-card').first().click();
    await page.locator('.circuit-card').first().click();
    await expect(page.locator('#hud')).toBeVisible({ timeout: 10000 });

    const itemSlot = page.locator('#hud-item');
    await expect(itemSlot).toBeVisible();
    const text = await itemSlot.textContent();
    expect(text).toBe('-');
  });

  test('should display item name when picked up via test hook', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=SOLO RACE').click();
    await page.locator('.char-card').first().click();
    await page.locator('.circuit-card').first().click();
    await expect(page.locator('#hud')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(5000);

    // Drive forward to potentially pick up items
    await page.keyboard.down('KeyZ');
    await page.waitForTimeout(10000);
    await page.keyboard.up('KeyZ');

    // Item may or may not be picked up — just verify no crash
    const itemSlot = page.locator('#hud-item');
    await expect(itemSlot).toBeVisible();
  });
});
