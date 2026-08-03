import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

const desktopViewport = { width: 1440, height: 900 };

async function getColumnWidth(page: Page, column: string) {
  return page
    .getByTestId(column)
    .first()
    .evaluate(element => element.getBoundingClientRect().width);
}

async function resizeColumn(page: Page, column: string, delta: number) {
  const resizeHandle = page.getByTestId(`resize-${column}`);
  const boundingBox = await resizeHandle.boundingBox();

  if (!boundingBox) {
    throw new Error(`Resize handle for ${column} is not visible`);
  }

  const x = boundingBox.x + boundingBox.width / 2;
  const y = boundingBox.y + boundingBox.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta, y);
  await page.mouse.up();
}

async function setStoredColumnWidths(
  page: Page,
  widths: Record<string, number>,
) {
  await page.evaluate(widths => {
    const key = Object.keys(localStorage).find(key =>
      key.endsWith('transactions.columnWidths'),
    );
    if (!key) {
      throw new Error('Transaction column widths preference was not found');
    }
    localStorage.setItem(key, JSON.stringify(widths));
  }, widths);
}

test.describe('Transaction column resizing', () => {
  test.use({ viewport: desktopViewport });

  test('persists resize across account navigation and reload, then resets without blocking sorting', async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: desktopViewport });
    const navigation = new Navigation(page);
    const configurationPage = new ConfigurationPage(page);

    try {
      await page.goto('/');
      await configurationPage.createTestFile();

      const accountPage = await navigation.goToAccountPage('Ally Savings');
      await accountPage.waitFor({ state: 'visible' });

      const initialDateWidth = await getColumnWidth(page, 'date');
      await resizeColumn(page, 'date', 40);

      await expect
        .poll(() => getColumnWidth(page, 'date'))
        .toBeGreaterThan(initialDateWidth);
      const resizedDateWidth = await getColumnWidth(page, 'date');

      const secondAccountPage = await navigation.goToAccountPage('Roth IRA');
      await secondAccountPage.waitFor({ state: 'visible' });
      await expect
        .poll(() => getColumnWidth(page, 'date'))
        .toBeCloseTo(resizedDateWidth, 0);

      const restoredAccountPage =
        await navigation.goToAccountPage('Ally Savings');
      await restoredAccountPage.waitFor({ state: 'visible' });
      await page.reload();
      await restoredAccountPage.waitFor({ state: 'visible' });
      await expect
        .poll(() => getColumnWidth(page, 'date'))
        .toBeCloseTo(resizedDateWidth, 0);

      const dateHeader = page.getByTestId('date').first();
      await dateHeader.getByRole('button').click();
      await expect(restoredAccountPage.transactionTable).toBeVisible();

      await page.getByTestId('resize-date').dblclick();
      await expect
        .poll(() => getColumnWidth(page, 'date'))
        .toBeCloseTo(initialDateWidth, 0);
    } finally {
      await page.close();
    }
  });

  test('keeps payment and deposit resizable after a narrow-to-wide viewport change', async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: desktopViewport });
    const navigation = new Navigation(page);
    const configurationPage = new ConfigurationPage(page);

    try {
      await page.goto('/');
      await configurationPage.createTestFile();

      const accountPage = await navigation.goToAccountPage('Ally Savings');
      await accountPage.waitFor({ state: 'visible' });
      await resizeColumn(page, 'date', 1);
      await setStoredColumnWidths(page, {
        payee: 198,
        notes: 425,
        category: 172,
        debit: 100,
        credit: 90,
      });

      await page.reload();
      await accountPage.waitFor({ state: 'visible' });

      await page.setViewportSize({ width: 1057, height: 861 });
      await page.setViewportSize(desktopViewport);
      await expect
        .poll(() => getColumnWidth(page, 'deposit'))
        .toBeGreaterThanOrEqual(90);
      const initialDepositWidth = await getColumnWidth(page, 'deposit');
      await resizeColumn(page, 'debit', -40);

      await expect
        .poll(() => getColumnWidth(page, 'deposit'))
        .toBeGreaterThan(initialDepositWidth);
      const expandedDepositWidth = await getColumnWidth(page, 'deposit');

      await resizeColumn(page, 'debit', 20);

      await expect
        .poll(() => getColumnWidth(page, 'deposit'))
        .toBeLessThan(expandedDepositWidth);
      await expect
        .poll(() => getColumnWidth(page, 'deposit'))
        .toBeGreaterThanOrEqual(90);
    } finally {
      await page.close();
    }
  });
});
