import { test, expect } from '@playwright/test';

// Regression: starting a race registers the pause keydown listener. Doing it
// again must NOT register a second listener, or Escape would toggle the menu
// twice (open+close) and it would never appear.

async function enterRace(page) {
  await page.locator('text=SOLO RACE').click();
  await page.locator('#select-btn').click();          // pick the current character
  await page.locator('.circuit-card').first().click(); // pick a circuit
  await expect(page.locator('#hud')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

test('Escape opens pause menu after re-entering a race', async ({ page }) => {
  await page.goto('/');

  // First race.
  await enterRace(page);

  // Back to menu via pause -> RETURN TO MENU.
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu')).toBeVisible();
  await page.locator('#menu-btn').click();
  await expect(page.locator('text=SOLO RACE')).toBeVisible({ timeout: 10000 });

  // Second race.
  await enterRace(page);

  // Escape must still open the pause menu.
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu')).toBeVisible();
});
