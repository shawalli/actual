import { describe, expect, test } from 'vitest';

import {
  getGiftCardActionVisibility,
  getGiftCardCategoryId,
  shouldShowGiftCardActions,
} from './giftCard';

describe('getGiftCardCategoryId', () => {
  test('prefers an active Income category', () => {
    expect(
      getGiftCardCategoryId([
        {
          is_income: true,
          categories: [
            { id: 'interest', name: 'Interest', hidden: false },
            { id: 'income', name: 'Income', hidden: false },
          ],
        },
      ]),
    ).toBe('income');
  });

  test('falls back to the first active income category', () => {
    expect(
      getGiftCardCategoryId([
        {
          is_income: true,
          categories: [
            { id: 'hidden-income', name: 'Income', hidden: true },
            { id: 'interest', name: 'Interest', hidden: false },
          ],
        },
      ]),
    ).toBe('interest');
  });
});

describe('shouldShowGiftCardActions', () => {
  const parent = {
    account: 'account',
    amount: -300,
    is_child: false,
    isGiftCard: false,
  };

  const giftCardChild = {
    account: 'account',
    amount: 0,
    is_child: true,
    isGiftCard: true,
  };

  const spendingChild = {
    account: 'account',
    amount: -300,
    is_child: true,
    isGiftCard: false,
  };

  test('shows both footer actions for a balanced new gift-card split', () => {
    expect(
      shouldShowGiftCardActions({
        isAdding: true,
        transactions: [parent, giftCardChild, spendingChild],
      }),
    ).toBe(true);
  });

  test('hides the actions without an account, a gift-card child, or a filled normal split', () => {
    expect(
      shouldShowGiftCardActions({
        isAdding: true,
        transactions: [
          { ...parent, account: '' },
          giftCardChild,
          spendingChild,
        ],
      }),
    ).toBe(false);
    expect(
      shouldShowGiftCardActions({
        isAdding: true,
        transactions: [parent, spendingChild],
      }),
    ).toBe(false);
    expect(
      shouldShowGiftCardActions({
        isAdding: true,
        transactions: [parent, giftCardChild, { ...spendingChild, amount: 0 }],
      }),
    ).toBe(false);
  });
});

describe('getGiftCardActionVisibility', () => {
  test('shows Gift Card without Split for a zero-amount transaction', () => {
    expect(
      getGiftCardActionVisibility({
        amount: 0,
        childTransactionCount: 0,
        hasGiftCardSplit: false,
      }),
    ).toEqual({
      showGiftCardAction: true,
      showSplitAction: false,
    });
  });

  test('shows Split and Gift Card when the amount is nonzero', () => {
    expect(
      getGiftCardActionVisibility({
        amount: -12.34,
        childTransactionCount: 0,
        hasGiftCardSplit: false,
      }),
    ).toEqual({
      showGiftCardAction: true,
      showSplitAction: true,
    });
  });

  test('hides both actions once a gift-card split exists', () => {
    expect(
      getGiftCardActionVisibility({
        amount: 0,
        childTransactionCount: 2,
        hasGiftCardSplit: true,
      }),
    ).toEqual({
      showGiftCardAction: false,
      showSplitAction: false,
    });
  });
});
