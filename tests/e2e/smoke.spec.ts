import { expect, test } from '@playwright/test';

const pages = ['/', '/audio/songwriting/rock-komposition/'];

for (const path of pages) {
  test(`lädt ${path} ohne Fehler`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
