import { describe, expect, it } from 'vitest';

import type { TransactionEntity } from '@actual-app/core/types/models';

import { getTransactionsWithSplitChildren } from './getTransactionsWithSplitChildren';

function transaction(
  id: TransactionEntity['id'],
  extra: Partial<TransactionEntity> = {},
) {
  return {
    id,
    amount: 0,
    date: '2026-07-14',
    flag: null,
    ...extra,
  } as TransactionEntity;
}

describe('getTransactionsWithSplitChildren', () => {
  it('attaches split children to the parent in occurrence order', () => {
    const result = getTransactionsWithSplitChildren([
      transaction('parent', { flag: ':red_circle:', is_parent: true }),
      transaction('child-1', {
        flag: ':blue_circle:',
        is_child: true,
        parent_id: 'parent',
      }),
      transaction('other', { flag: ':green_circle:' }),
      transaction('child-2', {
        flag: ':orange_circle:',
        is_child: true,
        parent_id: 'parent',
      }),
    ]);

    expect(result.map(t => t.id)).toEqual(['parent', 'other']);
    expect(result[0].subtransactions?.map(t => t.flag)).toEqual([
      ':blue_circle:',
      ':orange_circle:',
    ]);
  });
});
