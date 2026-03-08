import { test, expect } from '@playwright/test';

test.describe('Online Multiplayer', () => {
  test('should show online options in menu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=ONLINE: CREATE ROOM')).toBeVisible();
    await expect(page.locator('text=ONLINE: JOIN ROOM')).toBeVisible();
  });

  test('should open create room form', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=ONLINE: CREATE ROOM').click();
    await expect(page.locator('text=CREATE ROOM')).toBeVisible({ timeout: 5000 });
  });

  test('should open join room form', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=ONLINE: JOIN ROOM').click();
    await expect(page.locator('text=JOIN ROOM')).toBeVisible({ timeout: 5000 });
  });

  // Full multiplayer test requires running server
  test.skip('should create room and join from second context', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/');
    await page1.locator('text=ONLINE: CREATE ROOM').click();
    await page1.locator('#create-btn').click();

    // Get room code
    const codeText = await page1.locator('text=ROOM:').textContent();
    const code = codeText?.match(/\d{6}/)?.[0];
    expect(code).toBeTruthy();

    await page2.goto('/');
    await page2.locator('text=ONLINE: JOIN ROOM').click();
    await page2.locator('#code-input').fill(code);
    await page2.locator('#join-btn').click();

    // Both should see lobby
    await expect(page1.locator('text=PLAYERS')).toBeVisible();
    await expect(page2.locator('text=PLAYERS')).toBeVisible();

    await context1.close();
    await context2.close();
  });
});
