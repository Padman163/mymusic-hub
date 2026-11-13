import { expect, type Locator, test } from '@playwright/test';

const pages = ['/', '/audio/songwriting/rock-komposition/'];
const notationPage = '/audio/theory/100/104-tabulatur-notensystem/';
const guidePage = '/audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem/';

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

/** Erste Notation mit mindestens drei Takten in der ersten Zeile. */
function threeMeasureNotation(page: import('@playwright/test').Page): Locator {
  return page
    .locator('.notation-component')
    .filter({ has: page.locator('.notation-row:first-child .notation-cell:nth-child(3)') })
    .first();
}

test('bricht Notenwerte nach drei Takten um und richtet sie aus', async ({ page }) => {
  await page.goto(notationPage);

  const result = await page.locator('.notation-component').evaluateAll((components) =>
    components
      .map((component) => [...component.querySelectorAll<HTMLElement>('.notation-row')])
      .filter(
        (rows) =>
          rows.length === 2 &&
          rows[0].querySelectorAll('.notation-staff').length === 3 &&
          rows[1].querySelectorAll('.notation-staff').length === 1,
      )
      .map((rows) => ({
        clefs: rows.map((row) => row.querySelectorAll('.notation-clef').length),
        times: rows.map((row) => row.querySelectorAll('.notation-time').length),
        tops: [...rows[0].querySelectorAll('.notation-staff')].map(
          (element) => element.getBoundingClientRect().top,
        ),
      })),
  );
  expect(result.length).toBeGreaterThan(0);
  for (const { clefs, times, tops } of result) {
    expect(clefs).toEqual([1, 1]);
    expect(times[1]).toBe(0);
    expect(times[0]).toBeGreaterThan(0);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  }
});

test('verteilt die Schlüsselbeispiele bis zum Taktende rhythmisch', async ({ page }) => {
  await page.goto(notationPage);
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
  for (const measure of measures) {
    const interval = measure.positions[1] - measure.positions[0];
    expect(measure.width - measure.positions[10]).toBeCloseTo(interval, 5);
    for (let i = 2; i < measure.positions.length; i++) {
      expect(measure.positions[i] - measure.positions[i - 1]).toBeCloseTo(interval, 5);
    }
  }
});

test('unterstützt Bassschlüssel und horizontales Scrollen', async ({ page }) => {
  await page.goto(guidePage);

  const scrollable = page.locator('.notation-component.is-scrollable');
  await expect(scrollable.first()).toBeVisible();
  const clefs = await scrollable.first().locator('.notation-clef').allTextContents();
  expect(clefs).toEqual(['\uE062']);

  await page.setViewportSize({ width: 320, height: 900 });
  const overflow = await scrollable.evaluateAll((elements) =>
    elements.map((element) => ({
      overflowX: getComputedStyle(element).overflowX,
      scrolls: element.scrollWidth > element.clientWidth,
    })),
  );
  expect(overflow.every((item) => item.overflowX === 'auto')).toBe(true);
  expect(overflow.some((item) => item.scrolls)).toBe(true);
});

test('passt das 18-Takte-Beispiel an wechselnde Breiten an und behält die Taktart über Zeilen bei', async ({
  page,
}) => {
  await page.goto(guidePage);
  await page.evaluate(() => document.fonts.ready);
  const box = page
    .locator('.notation-component')
    .filter({ has: page.locator('.notation-cell:nth-child(2) >> nth=0') })
    .filter({ has: page.locator('.notation-row:nth-child(8)') })
    .first();
  await expect(box.locator('.notation-cell')).toHaveCount(18);

  for (const width of [320, 700, 1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() =>
      box.evaluate((element) => {
        const style = getComputedStyle(element);
        const right = element.getBoundingClientRect().right - parseFloat(style.paddingRight);
        return [...element.querySelectorAll<SVGElement>('.notation-staff')]
          .filter((staff) => staff.getClientRects().length > 0)
          .every((staff) => staff.getBoundingClientRect().right <= right + 1);
      }),
    ).toBe(true);
    await expect(box).toHaveAttribute('data-fitted');
    expect(await box.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
  const measure = box.locator('.notation-cell').nth(13);
  const fractions = await measure.locator('.notation-rest, .notation-note').evaluateAll((events) =>
    events.map((event) => Number(event.getAttribute('x')!.replace('%', ''))),
  );
  expect(fractions).toEqual([0, 25, 50]);
  await expect(measure.locator('.notation-time')).toHaveCount(0);
});

test('passt drei Takte ohne Scrollen an wechselnde Breiten an', async ({ page }) => {
  await page.goto(notationPage);
  await page.evaluate(() => document.fonts.ready);
  const box = threeMeasureNotation(page);
  const staffs = box.locator('.notation-row').first().locator('.notation-staff');
  await expect(staffs).toHaveCount(3);

  const heights: number[] = [];
  for (const width of [320, 768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () =>
      box.evaluate((element, viewportWidth) => {
        const grid = element.querySelector<HTMLElement>('.notation-systems')!;
        const style = getComputedStyle(element);
        const contentWidth = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return window.innerWidth === viewportWidth
          && (viewportWidth === 320 ? element.clientWidth <= 320 : element.clientWidth > 320)
          && element.hasAttribute('data-fitted')
          && element.scrollWidth <= element.clientWidth + 1
          && Math.abs(grid.getBoundingClientRect().width - contentWidth) < 1;
      }, width),
    ).toBe(true);
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

test('stellt drei Takte nicht kleiner als zuvor dar', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(notationPage);
  await page.evaluate(() => document.fonts.ready);
  const box = threeMeasureNotation(page);
  await expect(box).toHaveAttribute('data-fitted');
  const staffs = box.locator('.notation-row').first().locator('.notation-staff');
  await expect(staffs).toHaveCount(3);
  const bounds = await staffs.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  expect(Math.min(...bounds.map((rect) => rect.height))).toBeGreaterThanOrEqual(71);
  expect(await box.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});

test('behält ohne JavaScript die scrollbare Darstellung', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(notationPage);
    const box = threeMeasureNotation(page);
    await expect(box).not.toHaveAttribute('data-fitted');
    expect(await box.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  } finally {
    await context.close();
  }
});
