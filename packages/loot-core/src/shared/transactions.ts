import { v4 as uuidv4 } from 'uuid';

import { logger } from '#platform/server/log';
import type { TransactionEntity } from '#types/models';

import { applyChanges, diffItems, last } from './util';

export function isTemporaryId(id: string) {
  return id.indexOf('temp') !== -1;
}

export function isPreviewId(id: string) {
  return id.indexOf('preview/') !== -1;
}

// The amount might be null when adding a new transaction
function num(n: number | null | undefined) {
  return typeof n === 'number' ? n : 0;
}

function SplitTransactionError(total: number, parent: TransactionEntity) {
  const difference = num(parent.amount) - total;

  return {
    type: 'SplitTransactionError' as const,
    version: 1 as const,
    difference,
  };
}

type GenericTransactionEntity = TransactionEntity;

export const GIFT_CARD_NOTES = 'Gift Card';
export const GIFT_CARD_CATEGORY_ID = 'to-budget';

export function isGiftCardChild(transaction: TransactionEntity) {
  return !!transaction.is_child && !!transaction.isGiftCard;
}

export function findGiftCardChild(transaction: TransactionEntity) {
  return transaction.subtransactions?.find(isGiftCardChild) ?? null;
}

export function hasGiftCardChild(transaction: TransactionEntity) {
  return findGiftCardChild(transaction) != null;
}

export function keepGiftCardChildFirst(
  subtransactions: readonly TransactionEntity[] = [],
) {
  const giftCardChild = subtransactions.find(isGiftCardChild);

  if (!giftCardChild) {
    return [...subtransactions];
  }

  return [
    giftCardChild,
    ...subtransactions.filter(
      transaction => transaction.id !== giftCardChild.id,
    ),
  ];
}

export function makeChild<T extends GenericTransactionEntity>(
  parent: T,
  data: object = {},
) {
  const prefix = parent.id === 'temp' ? 'temp' : '';

  return {
    amount: 0,
    ...data,
    category: 'category' in data ? data.category : parent.category,
    payee: 'payee' in data ? data.payee : parent.payee,
    id: 'id' in data ? data.id : prefix + uuidv4(),
    account: parent.account,
    date: parent.date,
    flag: 'flag' in data ? data.flag : parent.flag,
    cleared: parent.cleared != null ? parent.cleared : null,
    reconciled: parent.reconciled != null ? parent.reconciled : null,
    starting_balance_flag:
      parent.starting_balance_flag != null
        ? parent.starting_balance_flag
        : null,
    sort_order:
      'sort_order' in data ? data.sort_order : (parent.sort_order ?? null),
    is_child: true,
    parent_id: parent.id,
    error: null,
  } as unknown as T;
}

export function makeGiftCardChild(
  parent: TransactionEntity,
  data: Partial<TransactionEntity> = {},
) {
  return makeChild(parent, {
    category: GIFT_CARD_CATEGORY_ID,
    ...data,
    isGiftCard: true,
    notes: GIFT_CARD_NOTES,
  });
}

export function makeEmptySplitSubtransactions(
  parent: TransactionEntity,
): TransactionEntity[] {
  return [
    makeChild(parent, { sort_order: -1 }),
    makeChild(parent, { sort_order: -2 }),
  ];
}

export function makeGiftCardSplitSubtransactions(
  parent: TransactionEntity,
  giftCardCategory: TransactionEntity['category'] = GIFT_CARD_CATEGORY_ID,
): TransactionEntity[] {
  return [
    makeGiftCardChild(parent, {
      category: giftCardCategory,
      sort_order: -1,
    }),
    makeChild(parent, { amount: parent.amount, sort_order: -2 }),
  ];
}

function makeNonChild<T extends GenericTransactionEntity>(
  parent: T,
  data: object,
) {
  return {
    amount: 0,
    ...data,
    cleared: parent.cleared != null ? parent.cleared : null,
    reconciled: parent.reconciled != null ? parent.reconciled : null,
    sort_order: parent.sort_order ?? null,
    starting_balance_flag: null,
    is_child: false,
    parent_id: null,
  } as unknown as T;
}

export function recalculateGiftCardSplit(
  transaction: TransactionEntity,
): TransactionEntity {
  const giftCardChild = findGiftCardChild(transaction);

  if (!giftCardChild) {
    return transaction;
  }

  const nonGiftCardTotal = (transaction.subtransactions ?? [])
    .filter(t => t.id !== giftCardChild.id)
    .reduce((total, t) => total + num(t.amount), 0);
  const giftCardAmount = num(transaction.amount) - nonGiftCardTotal;

  return {
    ...transaction,
    subtransactions: keepGiftCardChildFirst(
      transaction.subtransactions?.map(t =>
        t.id === giftCardChild.id
          ? {
              ...t,
              isGiftCard: true,
              category: t.category || GIFT_CARD_CATEGORY_ID,
              notes: GIFT_CARD_NOTES,
              amount: giftCardAmount,
            }
          : t,
      ),
    ),
  } satisfies TransactionEntity;
}

function makeTransactionWithChildCategory<T extends GenericTransactionEntity>(
  parent: T,
  data: Partial<TransactionEntity>,
) {
  return {
    ...parent,
    is_parent: false,
    category: data.category || null,
  } as unknown as T;
}

export function recalculateSplit(trans: TransactionEntity) {
  trans = recalculateGiftCardSplit(trans);

  // Calculate the new total of split transactions and make sure
  // that it equals the parent amount
  const total = (trans.subtransactions || []).reduce(
    (acc, t) => acc + num(t.amount),
    0,
  );

  const { error: _error, ...rest } = trans;
  return {
    ...rest,
    error:
      total === num(trans.amount) ? null : SplitTransactionError(total, trans),
  } satisfies TransactionEntity;
}

function findParentIndex(
  transactions: readonly TransactionEntity[],
  idx: number,
) {
  // This relies on transactions being sorted in a way where parents
  // are always before children, which is enforced in the db layer.
  // Walk backwards and find the last parent;
  while (idx >= 0) {
    const trans = transactions[idx];
    if (trans.is_parent) {
      return idx;
    }
    idx--;
  }
  return null;
}

function getSplit(
  transactions: readonly TransactionEntity[],
  parentIndex: number,
) {
  const split = [transactions[parentIndex]];
  let curr = parentIndex + 1;
  while (curr < transactions.length && transactions[curr].is_child) {
    split.push(transactions[curr]);
    curr++;
  }
  return split;
}

export function ungroupTransactions(transactions: TransactionEntity[]) {
  return transactions.reduce<TransactionEntity[]>((list, parent) => {
    const { subtransactions, ...trans } = parent;
    const _subtransactions = subtransactions || [];

    list.push(trans);

    for (let i = 0; i < _subtransactions.length; i++) {
      list.push(_subtransactions[i]);
    }
    return list;
  }, []);
}

export function groupTransaction(
  split: TransactionEntity[],
): TransactionEntity {
  return {
    ...split[0],
    subtransactions: split.slice(1),
  } satisfies TransactionEntity;
}

export function ungroupTransaction(split: TransactionEntity | null) {
  if (split == null) {
    return [];
  }
  return ungroupTransactions([split]);
}

export function applyTransactionDiff(
  groupedTrans: Parameters<typeof ungroupTransaction>[0],
  diff: Parameters<typeof applyChanges>[0],
) {
  return groupTransaction(
    applyChanges(
      diff,
      ungroupTransaction(groupedTrans) || [],
    ) as TransactionEntity[],
  );
}

function replaceTransactions(
  transactions: readonly TransactionEntity[],
  id: string,
  func: (transaction: TransactionEntity) => TransactionEntity | null,
): {
  data: TransactionEntity[];
  newTransaction: TransactionEntity | null;
  diff: ReturnType<typeof diffItems<TransactionEntity>>;
} {
  const idx = transactions.findIndex(t => t.id === id);
  const trans = transactions[idx];
  const transactionsCopy = [...transactions];

  if (idx === -1) {
    throw new Error('Tried to edit unknown transaction id: ' + id);
  }

  if (trans.is_parent || trans.is_child) {
    const parentIndex = findParentIndex(transactions, idx);
    if (parentIndex == null) {
      logger.log('Cannot find parent index');
      return {
        data: [],
        diff: { added: [], deleted: [], updated: [] },
        newTransaction: null,
      };
    }

    const split = getSplit(transactions, parentIndex);
    let grouped = func(groupTransaction(split));
    const newSplit = ungroupTransaction(grouped);

    let diff: ReturnType<typeof diffItems<TransactionEntity>>;
    if (newSplit == null) {
      // If everything was deleted, just delete the parent which will
      // delete everything
      diff = { added: [], deleted: [{ id: split[0].id }], updated: [] };
      grouped = { ...split[0], _deleted: true };
      transactionsCopy.splice(parentIndex, split.length);
    } else {
      diff = diffItems<TransactionEntity>(split, newSplit);
      transactionsCopy.splice(parentIndex, split.length, ...newSplit);
    }

    return { data: transactionsCopy, newTransaction: grouped, diff };
  } else {
    const grouped = func(trans);
    const newTrans = ungroupTransaction(grouped) || [];
    if (grouped) {
      grouped.subtransactions = grouped.subtransactions || [];
    }
    transactionsCopy.splice(idx, 1, ...newTrans);

    return {
      data: transactionsCopy,
      newTransaction: grouped || {
        ...trans,
        _deleted: true,
      },
      diff: diffItems<TransactionEntity>([trans], newTrans),
    };
  }
}

export function addSplitTransaction(
  transactions: readonly TransactionEntity[],
  id: string,
) {
  return replaceTransactions(transactions, id, trans => {
    if (!trans.is_parent) {
      return trans;
    }
    const prevSub = last(trans.subtransactions || []);
    trans.subtransactions?.push(
      makeChild(trans, {
        amount: 0,
        payee: prevSub?.payee ?? trans.payee,
        sort_order: num(prevSub && prevSub.sort_order) - 1,
      }),
    );
    return trans;
  });
}

export function addGiftCardSplitTransaction(
  transactions: readonly TransactionEntity[],
  id: string,
  giftCardCategory: TransactionEntity['category'] = GIFT_CARD_CATEGORY_ID,
) {
  return replaceTransactions(transactions, id, trans => {
    if (!trans.is_parent) {
      return recalculateSplit({
        ...trans,
        is_parent: true,
        payee: null,
        error: null,
        subtransactions: makeGiftCardSplitSubtransactions(
          trans,
          giftCardCategory,
        ),
      });
    }

    if (hasGiftCardChild(trans)) {
      return trans;
    }

    const selectedChild = trans.subtransactions?.find(t => t.id === id);
    const firstSubtransaction = trans.subtransactions?.[0];
    const giftCardChild = selectedChild
      ? makeGiftCardChild(trans, {
          ...selectedChild,
          category: giftCardCategory,
        })
      : makeGiftCardChild(trans, {
          category: giftCardCategory,
          sort_order: num(firstSubtransaction?.sort_order) + 1,
        });
    const subtransactions = [
      giftCardChild,
      ...(trans.subtransactions?.filter(t => t.id !== giftCardChild.id) ?? []),
    ];

    return recalculateSplit({
      ...trans,
      subtransactions,
    });
  });
}

export function updateTransaction(
  transactions: readonly TransactionEntity[],
  transaction: TransactionEntity,
) {
  return replaceTransactions(transactions, transaction.id, trans => {
    if (trans.is_parent) {
      const parent =
        trans.id === transaction.id ? { ...trans, ...transaction } : trans;
      const originalSubtransactions =
        parent.subtransactions ?? trans.subtransactions;
      const sub = originalSubtransactions?.map(t => {
        // Make sure to update the children to reflect the updated
        // properties (if the parent updated)

        let child = t;
        if (trans.id === transaction.id) {
          const { payee: childPayee, ...rest } = t;
          const newPayee =
            childPayee === trans.payee ? transaction.payee : childPayee;
          child = {
            ...rest,
            ...(newPayee != null ? { payee: newPayee } : {}),
          };
        } else if (t.id === transaction.id) {
          child = transaction;
        }

        return makeChild(parent, child);
      });

      return recalculateSplit({
        ...parent,
        ...(sub && { subtransactions: sub }),
      });
    } else if (
      transaction.subtransactions &&
      transaction.subtransactions.length > 0
    ) {
      // Converting a simple (non-split) transaction into a split — e.g.
      // `api.updateTransaction(id, { subtransactions: [...] })`. Mark it as a
      // parent and materialise each subtransaction as a proper child so it
      // inherits the parent's account/date; otherwise the children are inserted
      // without an `account` and the DB rejects them (#8207).
      const parent = {
        ...trans,
        ...transaction,
        is_parent: true,
        is_child: false,
        parent_id: undefined,
      };
      return recalculateSplit({
        ...parent,
        subtransactions: transaction.subtransactions.map((sub, index) =>
          makeChild(parent, {
            ...sub,
            sort_order: sub.sort_order ?? -(index + 1),
          }),
        ),
      });
    } else {
      return transaction;
    }
  });
}

export function deleteTransaction(
  transactions: TransactionEntity[],
  id: string,
) {
  return replaceTransactions(transactions, id, trans => {
    if (trans.is_parent) {
      if (trans.id === id) {
        return null;
      } else if (trans.subtransactions?.length === 1) {
        const { subtransactions: _subtransactions, ...rest } = trans;
        return {
          ...rest,
          is_parent: false,
          error: null,
        } satisfies TransactionEntity;
      } else {
        const sub = trans.subtransactions?.filter(t => t.id !== id);
        return recalculateSplit({
          ...trans,
          ...(sub && { subtransactions: sub }),
        });
      }
    } else {
      return null;
    }
  });
}

export function splitTransaction(
  transactions: readonly TransactionEntity[],
  id: string,
  createSubtransactions?: (
    parentTransaction: TransactionEntity,
  ) => TransactionEntity[],
) {
  return replaceTransactions(transactions, id, trans => {
    if (trans.is_parent || trans.is_child) {
      return trans;
    }

    const subtransactions = createSubtransactions?.(trans) || [
      makeChild(trans),
    ];

    const { error: _error, ...rest } = trans;

    return recalculateSplit({
      ...rest,
      is_parent: true,
      payee: null,
      error: null,
      subtransactions: subtransactions.map(t => ({
        ...t,
        sort_order: t.sort_order || -1,
      })),
    } satisfies TransactionEntity);
  });
}

export function realizeTempTransactions(
  transactions: TransactionEntity[],
): TransactionEntity[] {
  const parent = {
    ...transactions.find(t => !t.is_child),
    id: uuidv4(),
    sort_order: Date.now(),
  } as TransactionEntity;
  const children = transactions.filter(t => t.is_child);
  return [
    parent,
    ...children.map(
      child =>
        ({
          ...child,
          id: uuidv4(),
          parent_id: parent.id,
        }) satisfies TransactionEntity,
    ),
  ];
}

export function makeAsNonChildTransactions(
  childTransactionsToUpdate: TransactionEntity[],
  transactions: TransactionEntity[],
) {
  const [parentTransaction, ...childTransactions] = transactions;
  const newNonChildTransactions = childTransactionsToUpdate.map(t =>
    makeNonChild(parentTransaction, t),
  );

  const remainingChildTransactions = childTransactions.filter(
    t =>
      !newNonChildTransactions.some(updatedTrans => updatedTrans.id === t.id),
  );
  if (
    childTransactions.length === 1 &&
    childTransactionsToUpdate.length === 1 &&
    childTransactionsToUpdate[0].id === childTransactions[0].id
  ) {
    return {
      updated: [
        makeTransactionWithChildCategory(
          parentTransaction,
          childTransactionsToUpdate[0],
        ),
      ],
      deleted: [childTransactionsToUpdate[0]],
    };
  }

  const nonChildTransactionsToUpdate =
    remainingChildTransactions.length === 1
      ? [
          ...newNonChildTransactions,
          makeNonChild(parentTransaction, remainingChildTransactions[0]),
        ]
      : newNonChildTransactions;

  const deleteParentTransaction = remainingChildTransactions.length <= 1;

  const updatedParentTransaction = {
    ...parentTransaction,
    ...(!deleteParentTransaction
      ? {
          amount: remainingChildTransactions
            .map(t => t.amount)
            .reduce((total, amount) => total + amount, 0),
        }
      : {}),
  };

  return {
    updated: [
      ...(!deleteParentTransaction ? [updatedParentTransaction] : []),
      ...nonChildTransactionsToUpdate,
    ],
    deleted: [...(deleteParentTransaction ? [updatedParentTransaction] : [])],
  };
}
