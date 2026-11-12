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

test('bricht das Notensystem nach drei Takten um und richtet sie aus', async ({ page }) => {
  await page.goto('/audio/theory/100/104-tabulatur-notensystem/');

  const rows = page.locator('.notation-system-box').filter({
    has: page.locator('.notation-final-bar'),
  }).locator('.notation-system-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.notation-staff')).toHaveCount(3);
  await expect(rows.nth(1).locator('.notation-staff')).toHaveCount(1);
  await expect(rows.nth(0).locator('.notation-clef')).toHaveCount(1);
  await expect(rows.nth(1).locator('.notation-clef')).toHaveCount(1);
  await expect(rows.nth(0).locator('.notation-time')).toHaveCount(2);
  await expect(rows.nth(1).locator('.notation-time')).toHaveCount(0);
  const tops = await rows.nth(0).locator('.notation-staff').evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().top),
  );
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
});

test('verteilt die Schlüsselbeispiele bis zum Taktende rhythmisch', async ({ page }) => {
  await page.goto('/audio/theory/100/104-tabulatur-notensystem/');
  const measures = await page.locator('.notation-staff').evaluateAll((staffs) =>
    staffs.flatMap((staff) => {
      const notes = [...staff.querySelectorAll<SVGTextElement>('.notation-note')];
      if (notes.length !== 11) return [];
      const width = staff.getBoundingClientRect().width;
      const positions = notes.map((note) => {
        const fraction = Number(note.getAttribute('x')!.replace('%', '')) / 100;
        const offset = note.parentElement!.getAttribute('transform')!.match(/translate\(([^ ]+)/)![1];
        return fraction * width + Number(offset);
      });
      return [{ width, positions }];
    }),
  );
  expect(measures).toHaveLength(2);
  for (const [index, measure] of measures.entries()) {
    expect(measure.positions[0]).toBeCloseTo(index === 0 ? 63 : 68, 5);
    const interval = measure.positions[1] - measure.positions[0];
    expect(measure.width - measure.positions[10]).toBeCloseTo(interval, 5);
    for (let i = 2; i < measure.positions.length; i++) {
      expect(measure.positions[i] - measure.positions[i - 1]).toBeCloseTo(interval, 5);
    }
  }
});

test('unterstützt eine andere Taktzahl und den Bassschlüssel', async ({ page }) => {
  await page.goto('/audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem/');

  const rows = page.locator('.notation-system-box').filter({
    has: page.locator('.notation-final-bar'),
  }).locator('.notation-system-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.notation-staff')).toHaveCount(2);
  await expect(rows.nth(1).locator('.notation-staff')).toHaveCount(1);
  const clefs = await rows.locator('.notation-clef').allTextContents();
  expect(clefs).toEqual(['\uE062', '\uE062']);
  await page.setViewportSize({ width: 320, height: 900 });
  const box = page.locator('.notation-system-box').filter({
    has: page.locator('.notation-final-bar'),
  });
  expect(await box.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto');
  expect(await box.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});

test('passt die Übersicht an und behält die Taktart über Zeilen bei', async ({ page }) => {
  await page.goto('/audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem/');
  const box = page.locator('.notation-overview');
  for (const width of [320, 700, 1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => box.evaluate((element) => {
      const style = getComputedStyle(element);
      const right = element.getBoundingClientRect().right - parseFloat(style.paddingRight);
      return [...element.querySelectorAll<SVGElement>('.notation-staff')]
        .filter((staff) => staff.getClientRects().length > 0)
        .every((staff) => staff.getBoundingClientRect().right <= right + 1);
    })).toBe(true);
    await expect(box).toHaveAttribute('data-fitted');
    expect(await box.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
  const measure = page.locator('.overview-layout-narrow .overview-measure').nth(13);
  const fractions = await measure.locator('.notation-rest, .notation-note').evaluateAll((events) =>
    events.map((event) => Number(event.getAttribute('x')!.replace('%', ''))),
  );
  expect(fractions).toEqual([0, 25, 50]);
  await expect(measure.locator('.notation-time')).toHaveCount(0);
});

test('passt drei Takte ohne Scrollen an wechselnde Breiten an', async ({ page }) => {
  await page.goto('/audio/theory/100/104-tabulatur-notensystem/');
  await page.evaluate(() => document.fonts.ready);
  const box = page.locator('[data-fit-to-width]');
  const staffs = box.locator('.notation-system-row').first().locator('.notation-staff');
  await expect(staffs).toHaveCount(3);

  const heights: number[] = [];
  for (const width of [320, 768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () => box.evaluate((element, viewportWidth) => {
      const grid = element.querySelector<HTMLElement>('.notation-system-grid')!;
      const style = getComputedStyle(element);
      const contentWidth = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return window.innerWidth === viewportWidth
        && (viewportWidth === 320 ? element.clientWidth <= 320 : element.clientWidth > 320)
        && element.hasAttribute('data-fitted')
        && element.scrollWidth <= element.clientWidth + 1
        && Math.abs(grid.getBoundingClientRect().width - contentWidth) < 1;
    }, width)).toBe(true);
    if (heights.length === 1) {
      await expect.poll(async () => (await staffs.first().boundingBox())!.height).toBeGreaterThan(heights[0]);
    } else if (heights.length === 2) {
      await expect.poll(async () => Math.abs((await staffs.first().boundingBox())!.height - heights[0])).toBeLessThan(1);
    }

    const bounds = await staffs.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, height: rect.height };
      }),
    );
    const boxBounds = (await box.boundingBox())!;
    expect(bounds[0].left).toBeGreaterThanOrEqual(boxBounds.x);
    expect(bounds[2].right).toBeLessThanOrEqual(boxBounds.x + boxBounds.width);
    expect(bounds[1].left).toBeGreaterThanOrEqual(bounds[0].right - 1);
    expect(bounds[2].left).toBeGreaterThanOrEqual(bounds[1].right - 1);
    expect(Math.max(...bounds.map((rect) => rect.top)) - Math.min(...bounds.map((rect) => rect.top))).toBeLessThan(1);
    const finalBar = (await box.locator('.notation-final-bar').boundingBox())!;
    expect(finalBar.x + finalBar.width).toBeLessThanOrEqual(boxBounds.x + boxBounds.width);
    heights.push(bounds[0].height);
  }
  expect(heights[1]).toBeGreaterThan(heights[0]);
  expect(Math.abs(heights[2] - heights[0])).toBeLessThan(1);
});

test('stellt drei Takte auf derselben Fläche mindestens so groß wie zuvor dar', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/audio/theory/100/104-tabulatur-notensystem/');
  await page.evaluate(() => document.fonts.ready);
  const box = page.locator('[data-fit-to-width]');
  await expect(box).toHaveAttribute('data-fitted');
  const firstRow = box.locator('.notation-system-row').first();
  const staffs = firstRow.locator('.notation-staff');
  await expect(staffs).toHaveCount(3);
  const bounds = await staffs.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  expect(Math.min(...bounds.map((rect) => rect.height))).toBeGreaterThanOrEqual(71);
  expect(Math.max(...bounds.map((rect) => rect.width))).toBeLessThan(259);
  expect(await box.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});

test('behält ohne JavaScript die scrollbare Darstellung', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/audio/theory/100/104-tabulatur-notensystem/');
    const box = page.locator('[data-fit-to-width]');
    await expect(box).not.toHaveAttribute('data-fitted');
    expect(await box.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  } finally {
    await context.close();
  }
});
