import type { TransactionEntity } from '@actual-app/core/types/models';

export function getTransactionsWithSplitChildren(
  transactions: ReadonlyArray<TransactionEntity>,
) {
  const childrenByParent = new Map<
    TransactionEntity['id'],
    TransactionEntity[]
  >();

  for (const transaction of transactions) {
    if (transaction.is_child && transaction.parent_id) {
      const children = childrenByParent.get(transaction.parent_id) ?? [];
      children.push(transaction);
      childrenByParent.set(transaction.parent_id, children);
    }
  }

  return transactions
    .filter(transaction => !transaction.is_child)
    .map(transaction => ({
      ...transaction,
      ...(transaction.is_parent && {
        subtransactions: childrenByParent.get(transaction.id) ?? [],
      }),
    }));
}
