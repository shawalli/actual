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
});
