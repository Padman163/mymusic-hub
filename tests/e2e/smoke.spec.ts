import { expect, type Locator, test } from '@playwright/test';

const notationPage = '/audio/theory/100-general/104-tabulatur-notensystem/';
const guidePage = '/audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem/';
const pages = ['/', '/audio/songwriting/rock-komposition/', notationPage];

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

test('richtet Builder-Karten und Aktionen einheitlich aus', async ({ page }) => {
  await page.goto('/projektierung/modul-builder/');
  await expect(page.getByRole('tab')).toHaveText([
    'Übersicht',
    'Modul erstellen',
    'Quizfragen',
    'Einstellungen',
  ]);
  await expect(page.locator('#module-reload-btn')).toHaveCount(0);
  await expect(page.locator('#module-catalog-list')).toHaveAttribute('data-view', 'list');

  const toolbarCheck = await page
    .locator('.contribution-toolbar-controls')
    .evaluate((controls) => {
      const items = [...controls.children] as HTMLElement[];
      const menus = [...controls.querySelectorAll<HTMLElement>('.contribution-menu')];
      const rects = items.map((item) => item.getBoundingClientRect());
      return {
        count: items.length,
        tops: rects.map((rect) => rect.top),
        gap1: rects[1].left - rects[0].right,
        gap2: rects[2].left - rects[1].right,
        menuStyles: menus.map((menu) => {
          const style = getComputedStyle(menu);
          return { paddingLeft: style.paddingLeft, borderLeftWidth: style.borderLeftWidth };
        }),
      };
    });
  expect(toolbarCheck.count).toBe(3);
  expect(Math.max(...toolbarCheck.tops) - Math.min(...toolbarCheck.tops)).toBeLessThan(1);
  expect(Math.abs(toolbarCheck.gap1 - toolbarCheck.gap2)).toBeLessThan(1);
  for (const style of toolbarCheck.menuStyles) {
    expect(style).toEqual({ paddingLeft: '0px', borderLeftWidth: '0px' });
  }

  await page.getByRole('tab', { name: 'Modul erstellen' }).click();
  await page.locator('.theory-block-add').click();
  await page.locator('.theory-block-add').click();
  const controls = page.locator('.theory-block-row').nth(1).locator('.theory-block-controls');
  await page.locator('.theory-block-row').nth(1).locator('.theory-block-details > summary').click();
  const up = controls.locator('.theory-block-up');
  const down = controls.locator('.theory-block-down');
  const upBox = await up.boundingBox();
  const downBox = await down.boundingBox();
  expect(upBox).not.toBeNull();
  expect(downBox).not.toBeNull();
  if (!upBox || !downBox) throw new Error('Pfeile nicht sichtbar');
  expect(Math.abs((upBox.y + upBox.height / 2) - (downBox.y + downBox.height / 2))).toBeLessThan(1);
  const controlPlacement = await controls.evaluate((element) => {
    const row = element.parentElement!;
    const rowStyle = getComputedStyle(row);
    const controlsStyle = getComputedStyle(element);
    const rowRect = row.getBoundingClientRect();
    const controlsRect = element.getBoundingClientRect();
    return {
      topOffset: controlsRect.top - rowRect.top,
      rightOffset: rowRect.right - controlsRect.right,
      cardPaddingTop: Number.parseFloat(rowStyle.paddingTop),
      topInset: Number.parseFloat(controlsStyle.top),
      rightInset: Number.parseFloat(controlsStyle.right),
    };
  });
  expect(Math.abs(controlPlacement.topOffset - controlPlacement.rightOffset)).toBeLessThan(1);
  expect(controlPlacement.topInset).toBe(controlPlacement.cardPaddingTop);
  expect(controlPlacement.rightInset).toBe(controlPlacement.cardPaddingTop);
  await page.locator('.theory-block-row').nth(1).locator('.theory-block-details > summary').click();
  const collapsedBlockTopAlignment = await controls.evaluate((element) => {
    const summary = element.parentElement!.querySelector<HTMLElement>(
      '.theory-block-details > summary',
    )!;
    const summaryRect = summary.getBoundingClientRect();
    const controlsRect = element.getBoundingClientRect();
    return Math.abs(summaryRect.top - controlsRect.top);
  });
  expect(collapsedBlockTopAlignment).toBeLessThan(1);
  const collapsedBlockBottomPadding = Number.parseFloat(
    await page.locator('.theory-block-row').nth(1)
      .locator('.theory-block-details > summary')
      .evaluate((summary) => getComputedStyle(summary).paddingBottom),
  );
  expect(collapsedBlockBottomPadding).toBeGreaterThan(0);
  const controlStyles = await page.locator('.theory-block-controls > button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const style = getComputedStyle(button);
      return {
        height: button.getBoundingClientRect().height,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
      };
    }),
  );
  expect(new Set(controlStyles.map((style) => style.height)).size).toBe(1);
  expect(controlStyles.every((style) => style.marginTop === '0px' && style.marginBottom === '0px')).toBe(true);

  const actionButton = page.locator('.theory-block-group-selected');
  await page.locator('.theory-block-row').nth(0).locator('.theory-block-select').check();
  await page.locator('.theory-block-row').nth(1).locator('.theory-block-select').check();
  await actionButton.click();
  await page.locator('.theory-group-summary').click();
  await expect(page.locator('.theory-block-row[data-group-position="last"]')).toBeVisible();
  await expect(page.locator('.theory-block-add-type')).toBeVisible();
  const spacing = await page.locator('.theory-block-editor').evaluate((editor) => {
    const rows = editor.querySelector<HTMLElement>('.theory-block-rows')!;
    const groupCard = rows.querySelector<HTMLElement>('.theory-block-group')!;
    const groupRows = [...groupCard.querySelectorAll<HTMLElement>(
      '.theory-block-row, .module-exercise-row',
    )];
    const rowGap = Number.parseFloat(getComputedStyle(groupCard).rowGap);
    const addButton = editor.querySelector<HTMLElement>('.theory-block-add')!;
    const groupButton = editor.querySelector<HTMLElement>('.theory-block-group-selected')!;
    return {
      betweenGroupedRows:
        groupRows[1]!.getBoundingClientRect().top -
        groupRows[0]!.getBoundingClientRect().bottom,
      rowGap,
      actionHeights: [
        groupButton.getBoundingClientRect().height,
        addButton.getBoundingClientRect().height,
      ],
      actionTopMargins: [
        getComputedStyle(groupButton).marginTop,
        getComputedStyle(addButton).marginTop,
      ],
      rowCards: groupRows.map((row) => {
        const style = getComputedStyle(row);
        return { borderTopWidth: style.borderTopWidth, padding: style.padding };
      }),
    };
  });
  expect(Math.abs(spacing.betweenGroupedRows - spacing.rowGap)).toBeLessThan(1);
  expect(spacing.actionHeights.every((height) => height >= 44)).toBe(true);
  expect(spacing.actionTopMargins[0]).toBe(spacing.actionTopMargins[1]);
  expect(Number.parseFloat(spacing.actionTopMargins[0])).toBeGreaterThan(0);
  expect(spacing.rowCards[0]).toEqual(spacing.rowCards[1]);
  const groupedRowsInsideCard = await page.locator('.theory-block-group').evaluate((group) => {
    const groupRect = group.getBoundingClientRect();
    const members = [...group.querySelectorAll<HTMLElement>(
      '.theory-block-row, .module-exercise-row',
    )];
    return members.length === 2 && members.every((member) => {
      const rect = member.getBoundingClientRect();
      return rect.height > 0 && rect.top >= groupRect.top && rect.bottom <= groupRect.bottom;
    });
  });
  expect(groupedRowsInsideCard).toBe(true);
  const nestedControls = page.locator('.theory-block-row[data-group-position="first"] .theory-block-controls');
  const groupedRow = page.locator('.theory-block-row[data-group-position="last"]');
  const groupedLayout = await groupedRow.evaluate((row) => {
    const style = getComputedStyle(row);
    return { borderTopWidth: style.borderTopWidth, padding: style.padding };
  });
  expect(groupedLayout).toEqual(spacing.rowCards[0]);
  const groupButtons = page.locator('.theory-group-editor-actions > button');
  const groupButtonHeights = await groupButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  expect(new Set(groupButtonHeights).size).toBe(1);
  await expect(page.locator('.theory-group-ungroup')).toHaveText('−');
  const groupActionPlacement = await page.locator('.theory-group-editor-actions').evaluate((element) => {
    const group = element.closest<HTMLElement>('.theory-block-group')!;
    const groupStyle = getComputedStyle(group);
    const actionsStyle = getComputedStyle(element);
    const groupRect = group.getBoundingClientRect();
    const actionsRect = element.getBoundingClientRect();
    return {
      topOffset: actionsRect.top - groupRect.top,
      rightOffset: groupRect.right - actionsRect.right,
      cardPaddingTop: Number.parseFloat(groupStyle.paddingTop),
      topInset: Number.parseFloat(actionsStyle.top),
      rightInset: Number.parseFloat(actionsStyle.right),
    };
  });
  expect(Math.abs(groupActionPlacement.topOffset - groupActionPlacement.rightOffset)).toBeLessThan(1);
  expect(groupActionPlacement.rightInset).toBe(groupActionPlacement.cardPaddingTop);
  expect(groupActionPlacement.topInset).toBe(controlPlacement.topInset);
  expect(groupActionPlacement.rightInset).toBe(controlPlacement.rightInset);
  const groupControlBox = await nestedControls.boundingBox();
  const firstDetailsBox = await page.locator('.theory-block-row[data-group-position="first"] .theory-block-details').boundingBox();
  const groupedControlsMargin = Number.parseFloat(
    await nestedControls.evaluate((element) => getComputedStyle(element).marginTop),
  );
  const firstDetailsMargin = Number.parseFloat(
    await page.locator('.theory-block-row[data-group-position="first"] .theory-block-details')
      .evaluate((element) => getComputedStyle(element).marginTop),
  );
  expect(groupControlBox).not.toBeNull();
  expect(firstDetailsBox).not.toBeNull();
  if (!groupControlBox || !firstDetailsBox) throw new Error('Gruppenaktionen fehlen');
  expect(groupedControlsMargin).toBe(firstDetailsMargin);
  expect(Math.abs(groupControlBox.y - firstDetailsBox.y)).toBeLessThan(1);

  await page.locator('.theory-group-summary').click();
  await expect(page.locator('.theory-block-row[data-group-position="first"]'))
    .toHaveAttribute('data-group-collapsed', 'true');
  const collapsedGroupAlignment = await page
    .locator('.theory-block-group')
    .evaluate((row) => {
      const summary = row.querySelector<HTMLElement>('.theory-group-summary')!;
      const actions = row.querySelector<HTMLElement>('.theory-group-editor-actions')!;
      const summaryRect = summary.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      return Math.abs(
        summaryRect.top + summaryRect.height / 2 -
        (actionsRect.top + actionsRect.height / 2),
      );
    });
  expect(collapsedGroupAlignment).toBeLessThan(1);
  const collapsedGroupBottomPadding = Number.parseFloat(
    await page.locator('.theory-group-details > .theory-group-summary')
      .evaluate((summary) => getComputedStyle(summary).paddingBottom),
  );
  expect(collapsedGroupBottomPadding).toBeGreaterThan(0);

  await page.locator('#module-edit-cancel').evaluate((button) => {
    (button as HTMLButtonElement).hidden = false;
  });
  const formActionHeights = await page.locator('.module-builder-form .form-actions > button').evaluateAll((buttons) =>
    buttons.map((button) => ({
      height: button.getBoundingClientRect().height,
      marginTop: getComputedStyle(button).marginTop,
      marginBottom: getComputedStyle(button).marginBottom,
    })),
  );
  expect(formActionHeights[0].height).toBe(formActionHeights[1].height);
  expect(formActionHeights.every((style) => style.marginTop === '0px' && style.marginBottom === '0px')).toBe(true);

  await page.getByRole('tab', { name: 'Aufgaben' }).click();
  await page.selectOption('#exercise-question-type', 'interactive_notation');
  const compactOptions = await page.locator('#notation-compact option').evaluateAll((opts) =>
    opts.map((opt) => ({
      label: opt.textContent?.trim(),
      value: (opt as HTMLOptionElement).value,
    })),
  );
  expect(compactOptions).toEqual([
    { label: 'Kompakt', value: 'tight' },
    { label: 'Standard', value: 'wide' },
    { label: 'Breit', value: 'false' },
  ]);
  await expect(page.locator('#notation-compact')).toHaveValue('wide');

  await page.fill('#notation-max-notes', '4');
  await page.selectOption('#notation-compact', 'false');
  const preview = page.locator('#notation-live-preview [data-notation-builder]');
  await preview.focus();
  for (let slot = 0; slot < 4; slot += 1) {
    await page.keyboard.press('Space');
  }
  const alignment = await preview.evaluate((el) => {
    const notes = [...el.querySelectorAll<SVGElement>('.notation-note')];
    return notes.map((note) => {
      const nRect = note.getBoundingClientRect();
      return {
        cx: nRect.left + nRect.width / 2,
        cy: nRect.top + nRect.height / 2,
      };
    });
  });
  expect(alignment).toHaveLength(4);
  for (let slot = 0; slot < 3; slot += 1) {
    await page.keyboard.press('ArrowLeft');
  }
  for (let slot = 0; slot < 4; slot += 1) {
    const cursorCenter = await preview
      .locator('.notation-builder-cursor-head')
      .evaluate((cursor) => {
        const cRect = cursor.getBoundingClientRect();
        return {
          cx: cRect.left + cRect.width / 2,
          cy: cRect.top + cRect.height / 2,
        };
      });
    expect(Math.abs(cursorCenter.cx - alignment[slot].cx)).toBeLessThan(1);
    expect(Math.abs(cursorCenter.cy - alignment[slot].cy)).toBeLessThan(1);
    if (slot < 3) {
      await page.keyboard.press('ArrowRight');
    }
  }
});

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
