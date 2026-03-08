import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('should load game within 8 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await expect(page.locator('text=KHAOS KART')).toBeVisible({ timeout: 8000 });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(8000);
  });

  test('should maintain acceptable frame rate during race', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=SOLO RACE').click();
    await page.locator('.char-card').first().click();
    await page.locator('.circuit-card').first().click();
    await expect(page.locator('#hud')).toBeVisible({ timeout: 10000 });

    // Wait for countdown + some racing
    await page.waitForTimeout(6000);
    await page.keyboard.down('KeyZ');
    await page.waitForTimeout(3000);

    // Measure FPS using requestAnimationFrame
    const fps = await page.evaluate(() => {
      return new Promise((resolve) => {
        let count = 0;
        const start = performance.now();
        function frame() {
          count++;
          if (performance.now() - start >= 3000) {
            resolve(count / 3);
          } else {
            requestAnimationFrame(frame);
          }
        }
        requestAnimationFrame(frame);
      });
    });

    // Expect at least 20 FPS (lenient for CI)
    expect(fps).toBeGreaterThan(20);
    await page.keyboard.up('KeyZ');
  });
});
