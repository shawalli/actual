// @ts-strict-ignore
import { v4 as uuidv4 } from 'uuid';

import type { TransactionEntity } from '#types/models';

import {
  addSplitTransaction,
  deleteTransaction,
  GIFT_CARD_CATEGORY_ID,
  GIFT_CARD_NOTES,
  hasGiftCardChild,
  makeAsNonChildTransactions,
  makeChild,
  makeEmptySplitSubtransactions,
  makeGiftCardChild,
  splitTransaction,
  updateTransaction,
} from './transactions';

function makeTransaction(data: Partial<TransactionEntity>): TransactionEntity {
  return {
    id: uuidv4(),
    amount: 2422,
    date: '2020-01-05',
    account: 'acc-id-1',
    ...data,
  };
}

function makeSplitTransaction(data, children) {
  const parent = makeTransaction({ ...data, is_parent: true });
  return [parent, ...children.map(t => makeChild(parent, t))];
}

function splitError(amount: number) {
  return { difference: amount, type: 'SplitTransactionError', version: 1 };
}

describe('Transactions', () => {
  test('updating a transaction works', () => {
    const transactions = [
      makeTransaction({ amount: 5000 }),
      makeTransaction({ id: 't1', amount: 4000 }),
      makeTransaction({ amount: 3000 }),
    ];
    const { data, diff } = updateTransaction(
      transactions,
      makeTransaction({
        id: 't1',
        amount: 5000,
      }),
    );
    expect(data.find(d => d.subtransactions)).toBeFalsy();
    expect(diff).toEqual({
      added: [],
      deleted: [],
      updated: [expect.objectContaining({ id: 't1', amount: 5000 })],
    });
    expect(
      data
        .map(t => ({ id: t.id, amount: t.amount }))
        .sort(
          (a, b) =>
            b.amount - a.amount || String(a.id).localeCompare(String(b.id)),
        ),
    ).toEqual([
      { id: expect.any(String), amount: 5000 },
      { id: 't1', amount: 5000 },
      { id: expect.any(String), amount: 3000 },
    ]);
  });

  test('updating does nothing if value not changed', () => {
    const updatedTransaction = makeTransaction({ id: 't1', amount: 5000 });
    const transactions = [
      updatedTransaction,
      makeTransaction({ amount: 3000 }),
    ];
    const { data, diff } = updateTransaction(transactions, updatedTransaction);
    expect(diff).toEqual({ added: [], deleted: [], updated: [] });
    expect(
      data
        .map(t => ({ id: t.id, amount: t.amount }))
        .sort(
          (a, b) =>
            b.amount - a.amount || String(a.id).localeCompare(String(b.id)),
        ),
    ).toEqual([
      { id: expect.any(String), amount: 5000 },
      { id: expect.any(String), amount: 3000 },
    ]);
  });

  test('deleting a transaction works', () => {
    const transactions = [
      makeTransaction({ amount: 5000 }),
      makeTransaction({ id: 't1', amount: 4000 }),
      makeTransaction({ amount: 3000 }),
    ];
    const { data, diff } = deleteTransaction(transactions, 't1');

    expect(diff).toEqual({
      added: [],
      deleted: [{ id: 't1' }],
      updated: [],
    });
    expect(
      data
        .map(t => ({ id: t.id, amount: t.amount }))
        .sort(
          (a, b) =>
            b.amount - a.amount || String(a.id).localeCompare(String(b.id)),
        ),
    ).toEqual([
      { id: expect.any(String), amount: 5000 },
      { id: expect.any(String), amount: 3000 },
    ]);
  });

  test('splitting a transaction works', () => {
    const transactions = [
      makeTransaction({ id: 't1', amount: 5000, payee: 'payee-id' }),
      makeTransaction({ amount: 3000 }),
    ];
    const { data, diff } = splitTransaction(transactions, 't1');
    expect(data.find(d => d.subtransactions)).toBeFalsy();

    expect(diff).toEqual({
      added: [expect.objectContaining({ amount: 0, parent_id: 't1' })],
      deleted: [],
      updated: [
        {
          id: 't1',
          is_parent: true,
          payee: null,
          error: splitError(5000),
        },
      ],
    });
    expect(data).toEqual([
      expect.objectContaining({
        id: 't1',
        amount: 5000,
        error: splitError(5000),
        payee: null,
      }),
      expect.objectContaining({
        parent_id: 't1',
        amount: 0,
        payee: 'payee-id',
      }),
      expect.objectContaining({ amount: 3000 }),
    ]);
  });

  test('makeEmptySplitSubtransactions assigns distinct descending sort orders', () => {
    const parent = makeTransaction({
      id: 't1',
      amount: 5000,
      sort_order: 1234,
    });
    const children = makeEmptySplitSubtransactions(parent);

    expect(children).toHaveLength(2);
    expect(children.every(c => c.parent_id === 't1')).toBe(true);
    expect(children.map(c => c.sort_order)).toEqual([-1, -2]);
  });

  test('splitting respects explicit child sort orders', () => {
    const transactions = [makeTransaction({ id: 't1', amount: 5000 })];
    const { data } = splitTransaction(transactions, 't1', parent => [
      makeChild(parent, { sort_order: -10 }),
      makeChild(parent, { sort_order: -20 }),
    ]);

    const children = data.filter(t => t.parent_id === 't1');
    expect(children.map(t => t.sort_order)).toEqual([-10, -20]);
  });

  test.each`
    parentAmount | firstSpending | secondSpending | giftAmount
    ${0}         | ${-2}         | ${-3}          | ${5}
    ${-2}        | ${-2}         | ${-3}          | ${3}
    ${-5}        | ${-2}         | ${-3}          | ${0}
  `(
    'recalculates a gift-card split for parent $parentAmount and spending splits',
    ({ parentAmount, firstSpending, secondSpending, giftAmount }) => {
      const transactions = [
        ...makeSplitTransaction({ id: 't1', amount: parentAmount }, [
          { id: 't3', amount: firstSpending },
          { id: 't2', amount: 999, isGiftCard: true, notes: 'Changed' },
          { id: 't4', amount: secondSpending },
        ]),
      ];

      const { data, diff } = updateTransaction(
        transactions,
        makeTransaction({ id: 't4', amount: secondSpending }),
      );

      expect(data).toEqual([
        expect.objectContaining({ id: 't1', error: null }),
        expect.objectContaining({
          id: 't2',
          isGiftCard: true,
          notes: GIFT_CARD_NOTES,
          amount: giftAmount,
        }),
        expect.objectContaining({ id: 't3', amount: firstSpending }),
        expect.objectContaining({ id: 't4', amount: secondSpending }),
      ]);
      expect(diff.updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 't1', error: null }),
          expect.objectContaining({
            id: 't2',
            notes: GIFT_CARD_NOTES,
            amount: giftAmount,
          }),
        ]),
      );
    },
  );

  test('editing sibling splits recalculates the gift-card amount', () => {
    const transactions = [
      ...makeSplitTransaction({ id: 't1', amount: -2 }, [
        { id: 't2', amount: 3, isGiftCard: true },
        { id: 't3', amount: -2 },
        { id: 't4', amount: -3 },
      ]),
    ];

    const { data, diff } = updateTransaction(
      transactions,
      makeTransaction({ id: 't4', amount: -4 }),
    );

    expect(data).toEqual([
      expect.objectContaining({ id: 't1', error: null }),
      expect.objectContaining({ id: 't2', amount: 4, isGiftCard: true }),
      expect.objectContaining({ id: 't3', amount: -2 }),
      expect.objectContaining({ id: 't4', amount: -4 }),
    ]);
    expect(diff.updated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 't2', amount: 4 }),
        expect.objectContaining({ id: 't4', amount: -4 }),
      ]),
    );
  });

  test('recalculates a return gift-card split in the opposite direction', () => {
    const transactions = [
      ...makeSplitTransaction({ id: 't1', amount: 5 }, [
        { id: 't3', amount: 3 },
        {
          id: 't2',
          amount: 0,
          category: 'income-cat',
          isGiftCard: true,
        },
      ]),
    ];

    const { data, diff } = updateTransaction(
      transactions,
      makeTransaction({ id: 't3', amount: 4 }),
    );

    expect(data).toEqual([
      expect.objectContaining({ id: 't1', error: null }),
      expect.objectContaining({
        id: 't2',
        amount: 1,
        category: 'income-cat',
        isGiftCard: true,
      }),
      expect.objectContaining({ id: 't3', amount: 4 }),
    ]);
    expect(diff.updated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 't2', amount: 1 }),
        expect.objectContaining({ id: 't3', amount: 4 }),
      ]),
    );
  });

  test('supports a gift-card outflow and category inflow on reversal splits', () => {
    const transactions = [
      ...makeSplitTransaction({ id: 't1', amount: 1 }, [
        { id: 't3', amount: 4 },
        { id: 't2', amount: -3, category: 'income-cat', isGiftCard: true },
      ]),
    ];

    const { data } = updateTransaction(
      transactions,
      makeTransaction({ id: 't3', amount: 5 }),
    );

    expect(data).toEqual([
      expect.objectContaining({ id: 't1', error: null }),
      expect.objectContaining({
        id: 't2',
        amount: -4,
        category: 'income-cat',
        isGiftCard: true,
      }),
      expect.objectContaining({ id: 't3', amount: 5 }),
    ]);
  });

  test('creates a gift-card child with durable defaults', () => {
    const parent = makeTransaction({
      id: 't1',
      amount: -5,
      account: 'account-id',
      date: '2020-02-03',
      payee: 'payee-id',
    });

    const child = makeGiftCardChild(parent);

    expect(child).toEqual(
      expect.objectContaining({
        isGiftCard: true,
        is_child: true,
        parent_id: 't1',
        notes: GIFT_CARD_NOTES,
        category: GIFT_CARD_CATEGORY_ID,
        account: 'account-id',
        date: '2020-02-03',
        payee: 'payee-id',
      }),
    );
    expect(hasGiftCardChild({ ...parent, subtransactions: [child] })).toBe(
      true,
    );
  });

  test('splitting a normal transaction with a gift-card child derives the gift amount immediately', () => {
    const transactions = [makeTransaction({ id: 't1', amount: -2 })];

    const { data, diff } = splitTransaction(transactions, 't1', parent => [
      makeGiftCardChild(parent),
      makeChild(parent, { id: 't2', amount: -3 }),
    ]);

    expect(data).toEqual([
      expect.objectContaining({ id: 't1', error: null }),
      expect.objectContaining({
        isGiftCard: true,
        notes: GIFT_CARD_NOTES,
        amount: 1,
      }),
      expect.objectContaining({ id: 't2', amount: -3 }),
    ]);
    expect(diff.updated).toEqual([
      expect.objectContaining({ id: 't1', is_parent: true, error: null }),
    ]);
  });

  test('adding a split transaction works', () => {
    const transactions = [
      makeTransaction({ amount: 2001 }),
      ...makeSplitTransaction({ id: 't1', amount: 2500 }, [
        { id: 't2', amount: 2000 },
        { id: 't3', amount: 500 },
      ]),
      makeTransaction({ amount: 3002 }),
    ];

    expect(transactions.filter(t => t.parent_id === 't1').length).toBe(2);

    // Should be able to pass in any id from the split trans
    const { data, diff } = addSplitTransaction(transactions, 't1');
    expect(data.find(d => d.subtransactions)).toBeFalsy();

    expect(data.filter(t => t.parent_id === 't1').length).toBe(3);
    expect(diff).toEqual({
      added: [
        expect.objectContaining({
          id: expect.any(String),
          amount: 0,
          parent_id: 't1',
        }),
      ],
      deleted: [],
      updated: [],
    });
    expect(data.length).toBe(6);
  });

  test('adding a split transaction reuses the previous child payee', () => {
    const transactions = [
      ...makeSplitTransaction({ id: 't1', amount: 2500, payee: null }, [
        { id: 't2', amount: 2000, payee: 'payee-id' },
      ]),
    ];

    const { diff } = addSplitTransaction(transactions, 't1');

    expect(diff.added).toEqual([
      expect.objectContaining({
        amount: 0,
        parent_id: 't1',
        payee: 'payee-id',
      }),
    ]);
  });

  test('updating a split child flag preserves the parent flag', () => {
    const transactions = [
      ...makeSplitTransaction(
        { id: 't1', amount: 2500, flag: ':large_blue_circle:' },
        [{ id: 't2', amount: 2500 }],
      ),
    ];

    const { data, diff } = updateTransaction(
      transactions,
      makeTransaction({
        id: 't2',
        amount: 2500,
        flag: ':orange_circle:',
      }),
    );

    expect(data).toEqual([
      expect.objectContaining({
        id: 't1',
        flag: ':large_blue_circle:',
      }),
      expect.objectContaining({
        id: 't2',
        flag: ':orange_circle:',
      }),
    ]);
    expect(diff).toEqual({
      added: [],
      deleted: [],
      updated: [
        { id: 't1', error: null },
        { id: 't2', flag: ':orange_circle:' },
      ],
    });
  });

  test('updating a split parent flag preserves child flags', () => {
    const transactions = [
      ...makeSplitTransaction(
        { id: 't1', amount: 2500, flag: ':large_blue_circle:' },
        [{ id: 't2', amount: 2500, flag: ':orange_circle:' }],
      ),
    ];

    const { data, diff } = updateTransaction(
      transactions,
      makeTransaction({
        id: 't1',
        amount: 2500,
        flag: ':green_circle:',
      }),
    );

    expect(data).toEqual([
      expect.objectContaining({
        id: 't1',
        flag: ':green_circle:',
      }),
      expect.objectContaining({
        id: 't2',
        flag: ':orange_circle:',
      }),
    ]);
    expect(diff).toEqual({
      added: [],
      deleted: [],
      updated: [{ id: 't1', flag: ':green_circle:', error: null }],
    });
  });

  test('updating a split transaction works', () => {
    const transactions = [
      makeTransaction({ amount: 2001 }),
      ...makeSplitTransaction({ id: 't1', amount: 2500 }, [
        { id: 't2', amount: 2000 },
        { id: 't3', amount: 500 },
      ]),
      makeTransaction({ amount: 3002 }),
    ];
    const { data, diff } = updateTransaction(
      transactions,
      makeTransaction({
        id: 't2',
        amount: 2200,
      }),
    );
    expect(data.find(d => d.subtransactions)).toBeFalsy();
    expect(diff).toEqual({
      added: [],
      deleted: [],
      updated: [
        { id: 't1', error: splitError(-200) },
        { id: 't2', amount: 2200 },
      ],
    });
    expect(data.length).toBe(5);
  });

  test('partially updating a split parent preserves amount and does not set error', () => {
    const transactions = [
      makeTransaction({ amount: 2001 }),
      ...makeSplitTransaction({ id: 't1', amount: 2500 }, [
        { id: 't2', amount: 2000 },
        { id: 't3', amount: 500 },
      ]),
      makeTransaction({ amount: 3002 }),
    ];

    // Simulate a partial update (only `notes`) on the parent — this is
    // how `api.updateTransaction(id, { notes: '...' })` calls it in
    // `api.ts`: `updateTransaction(transactions, { id, ...fields })`.
    const { data, diff } = updateTransaction(transactions, {
      id: 't1',
      notes: 'updated note',
    } as TransactionEntity);

    // The parent should get the updated notes without an error
    const parent = data.find(d => d.id === 't1');
    expect(parent?.notes).toBe('updated note');
    expect(parent?.amount).toBe(2500);
    expect(parent?.error).toBeNull();

    // Children should be unchanged
    expect(data.filter(t => t.parent_id === 't1').length).toBe(2);

    expect(diff).toEqual({
      added: [],
      deleted: [],
      updated: [expect.objectContaining({ id: 't1', notes: 'updated note' })],
    });
  });

  test('deleting a split transaction works', () => {
    const transactions = [
      makeTransaction({ amount: 2001 }),
      ...makeSplitTransaction({ id: 't1', amount: 2500 }, [
        { id: 't2', amount: 2000 },
        { id: 't3', amount: 500 },
      ]),
      makeTransaction({ amount: 3002 }),
    ];
    const { data, diff } = deleteTransaction(transactions, 't2');

    expect(diff).toEqual({
      added: [],
      deleted: [expect.objectContaining({ id: 't2' })],
      updated: [{ id: 't1', error: splitError(2000) }],
    });
    expect(data).toEqual([
      expect.objectContaining({ amount: 2001 }),
      expect.objectContaining({
        amount: 2500,
        is_parent: true,
        error: splitError(2000),
      }),
      expect.objectContaining({ amount: 500, parent_id: 't1' }),
      expect.objectContaining({ amount: 3002 }),
    ]);
  });

  test('deleting all child split transactions works', () => {
    const transactions = [
      makeTransaction({ amount: 2001 }),
      ...makeSplitTransaction(
        { id: 't1', amount: 2500, error: splitError(500) },
        [{ id: 't2', amount: 2000 }],
      ),
      makeTransaction({ amount: 3002 }),
    ];
    const { data } = deleteTransaction(transactions, 't2');

    expect(data).toEqual([
      expect.objectContaining({ amount: 2001 }),
      // Must delete error if no children
      expect.objectContaining({ amount: 2500, error: null }),
      expect.objectContaining({ amount: 3002 }),
    ]);
  });

  test('unlocking a reconciled split transaction propagates to children', () => {
    const transactions = [
      makeTransaction({ amount: 2001 }),
      ...makeSplitTransaction({ id: 't1', amount: 2500, reconciled: true }, [
        { id: 't2', amount: 2000, reconciled: true },
        { id: 't3', amount: 500, reconciled: true },
      ]),
      makeTransaction({ amount: 3002 }),
    ];

    const { data, diff } = updateTransaction(transactions, {
      ...transactions.find(t => t.id === 't1')!,
      reconciled: false,
    });

    const children = data.filter(t => t.parent_id === 't1');
    expect(children).toHaveLength(2);
    expect(children.every(t => t.reconciled === false)).toBe(true);

    expect(diff.updated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 't1', reconciled: false }),
        expect.objectContaining({ id: 't2', reconciled: false }),
        expect.objectContaining({ id: 't3', reconciled: false }),
      ]),
    );
  });

  test('unsplitting last remaining child converts parent to regular transaction', () => {
    const [parent, child] = makeSplitTransaction(
      { id: 't1', amount: 2000, category: 'cat1' },
      [{ id: 't2', amount: 0, category: 'cat2' }],
    );

    const transactions = [parent, child];

    const result = makeAsNonChildTransactions([child], transactions);

    expect(result.updated).toHaveLength(1);
    expect(result.deleted).toHaveLength(1);

    expect(result.updated[0]).toMatchObject({
      id: 't1',
      amount: 2000,
      is_parent: false,
      category: 'cat2',
    });

    expect(result.deleted[0]).toMatchObject({
      id: 't2',
    });
  });
});
