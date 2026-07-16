import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileNavigation } from './page-models/mobile-navigation';
import { MobileTransactionEntryPage } from './page-models/mobile-transaction-entry-page';

test.describe('Mobile Transactions', () => {
  let page: Page;
  let navigation: MobileNavigation;
  let configurationPage: ConfigurationPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new MobileNavigation(page);
    configurationPage = new ConfigurationPage(page);

    await page.setViewportSize({
      width: 350,
      height: 600,
    });
    await page.goto('/');
    await configurationPage.createTestFile();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('creates a transaction via footer button', async () => {
    const transactionEntryPage = await navigation.goToTransactionEntryPage();
    await expect(page).toMatchThemeScreenshots();

    await expect(transactionEntryPage.header).toHaveText('New Transaction');

    await transactionEntryPage.fillAmount('12.34');
    // Click anywhere to cancel active edit.
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('payee-field'),
      'Kroger',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('category-field'),
      'Clothing',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('account-field'),
      'Ally Savings',
    );
    await expect(page).toMatchThemeScreenshots();

    await transactionEntryPage.createTransaction();
    await expect(page.getByLabel('Transaction list')).toHaveCount(0);
    await expect(page).toMatchThemeScreenshots();
  });

  test('prefills a new transaction with URL search params', async () => {
    const transactionEntryPage = await navigation.goToTransactionEntryPage();
    await page.goto(
      transactionEntryPage.page.url() +
        '?category=Food&amount=23.42&account=HSBC&date=2025-10-31&cleared=true&payee=Kroger&notes=just+a+note',
    );
    // Note: no easy way to test cleared checkbox
    await expect(page.getByTestId('transaction-form'))
      .toMatchAriaSnapshot(`- text: Amount
- textbox
- text: "23.42"
- button "Flag" [disabled]:
  - img
- text: Payee
- button "Kroger" [disabled]:
  - img
  - text: Kroger
- text: Category
- button "Food" [disabled]:
  - img
  - text: Food
- button "Split" [disabled]:
  - img
  - text: Split
- button "Gift Card" [disabled]:
  - img
  - text: Gift Card
- text: Account
- button "HSBC" [disabled]:
  - img
  - text: HSBC
- text: Date
- img
- textbox [disabled]: 2025-10-31
- text: Cleared Notes
- img
- textbox "Add a note (optional)" [disabled]: just a note`);
  });

  test('creates a transaction from `/accounts/:id` page', async () => {
    const accountsPage = await navigation.goToAccountsPage();
    const accountPage = await accountsPage.openNthAccount(2);
    const transactionEntryPage = await accountPage.clickCreateTransaction();

    await expect(transactionEntryPage.header).toHaveText('New Transaction');
    await expect(page).toMatchThemeScreenshots();

    await transactionEntryPage.fillAmount('12.34');
    // Click anywhere to cancel active edit.
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('payee-field'),
      'Kroger',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('category-field'),
      'Clothing',
    );

    await transactionEntryPage.createTransaction();

    await expect(accountPage.transactions.nth(0)).toHaveText(
      'KrogerClothing-12.34',
    );
  });

  test('creates and expands a gift-card split transaction', async () => {
    const transactionEntryPage = await navigation.goToTransactionEntryPage();

    await transactionEntryPage.fillAmount('12.34');
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('payee-field'),
      'Kroger',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('category-field'),
      'Clothing',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('account-field'),
      'Ally Savings',
    );

    await page.getByTestId('gift-card-action').click();

    const giftCardSummary = page.getByTestId('gift-card-summary');
    await expect(giftCardSummary).toContainText('Gift Card');
    await expect(
      transactionEntryPage.footer.getByRole('button', {
        name: 'Add new split',
      }),
    ).toBeVisible();
    await expect(transactionEntryPage.addTransactionButton).toBeVisible();

    await giftCardSummary.click();
    await expect(
      page.getByTestId(/^category-field-/).filter({ hasText: 'Income' }),
    ).toBeVisible();

    await transactionEntryPage.footer
      .getByRole('button', { name: 'Add new split' })
      .click();
    await expect(page.getByText('Delete split')).toHaveCount(3);
  });

  test('creates a flagged transaction from `/accounts/:id` page', async () => {
    const accountsPage = await navigation.goToAccountsPage();
    const accountPage = await accountsPage.openNthAccount(2);
    const transactionEntryPage = await accountPage.clickCreateTransaction();

    await transactionEntryPage.fillAmount('12.34');
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('payee-field'),
      'Kroger',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('category-field'),
      'Clothing',
    );
    await transactionEntryPage.setFlag('🔵');

    await transactionEntryPage.createTransaction();

    await expect(accountPage.transactions.nth(0)).toContainText('Kroger');
    await expect(accountPage.transactions.nth(0)).toContainText('🔵');
  });

  test('edits an existing transaction flag from `/accounts/:id` page', async () => {
    const accountsPage = await navigation.goToAccountsPage();
    const accountPage = await accountsPage.openNthAccount(2);
    let transactionEntryPage = await accountPage.clickCreateTransaction();

    await transactionEntryPage.fillAmount('12.34');
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('payee-field'),
      'Kroger',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('category-field'),
      'Clothing',
    );
    await transactionEntryPage.createTransaction();

    await accountPage.transactions.nth(0).click();
    transactionEntryPage = new MobileTransactionEntryPage(page);
    await transactionEntryPage.waitFor();
    await transactionEntryPage.setFlag('🔵');
    await transactionEntryPage.saveChanges();

    await expect(accountPage.transactions.nth(0)).toContainText('🔵');
  });

  test('clears an existing transaction flag from `/accounts/:id` page', async () => {
    const accountsPage = await navigation.goToAccountsPage();
    const accountPage = await accountsPage.openNthAccount(2);
    let transactionEntryPage = await accountPage.clickCreateTransaction();

    await transactionEntryPage.fillAmount('12.34');
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('payee-field'),
      'Kroger',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('category-field'),
      'Clothing',
    );
    await transactionEntryPage.setFlag('🔵');
    await transactionEntryPage.createTransaction();

    await accountPage.transactions.nth(0).click();
    transactionEntryPage = new MobileTransactionEntryPage(page);
    await transactionEntryPage.waitFor();
    await transactionEntryPage.removeFlag();
    await transactionEntryPage.saveChanges();

    await expect(accountPage.transactions.nth(0)).not.toContainText('🔵');
  });

  test('creates an uncategorized transaction from `/categories/uncategorized` page', async () => {
    // Create uncategorized transaction
    let transactionEntryPage = await navigation.goToTransactionEntryPage();
    await transactionEntryPage.fillAmount('12.35');
    // Click anywhere to cancel active edit.
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('account-field'),
      'Ally Savings',
    );
    await transactionEntryPage.createTransaction();

    const uncategorizedPage = await navigation.goToUncategorizedPage();
    transactionEntryPage = await uncategorizedPage.clickCreateTransaction();

    await expect(transactionEntryPage.header).toHaveText('New Transaction');

    await transactionEntryPage.fillAmount('12.34');
    // Click anywhere to cancel active edit.
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('payee-field'),
      'Kroger',
    );

    await transactionEntryPage.createTransaction();

    await expect(uncategorizedPage.transactions.nth(0)).toHaveText(
      'KrogerUncategorized-12.34',
    );
    await expect(page).toMatchThemeScreenshots();
  });

  test('creates a categorized transaction from `/categories/uncategorized` page', async () => {
    // Create uncategorized transaction
    let transactionEntryPage = await navigation.goToTransactionEntryPage();
    await transactionEntryPage.fillAmount('12.35');
    // Click anywhere to cancel active edit.
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('account-field'),
      'Ally Savings',
    );
    await transactionEntryPage.createTransaction();

    const uncategorizedPage = await navigation.goToUncategorizedPage();
    transactionEntryPage = await uncategorizedPage.clickCreateTransaction();

    await expect(transactionEntryPage.header).toHaveText('New Transaction');

    await transactionEntryPage.fillAmount('12.34');
    // Click anywhere to cancel active edit.
    await transactionEntryPage.header.click();
    await transactionEntryPage.fillField(
      page.getByTestId('payee-field'),
      'Kroger',
    );
    await transactionEntryPage.fillField(
      page.getByTestId('category-field'),
      'Clothing',
    );

    await transactionEntryPage.createTransaction();

    await expect(uncategorizedPage.transactions.nth(0)).toHaveText(
      '(No payee)Uncategorized-12.35',
    );
    await expect(page).toMatchThemeScreenshots();
  });
});
