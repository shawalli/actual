export const transactionColumnIds = [
  'date',
  'account',
  'payee',
  'notes',
  'category',
  'debit',
  'credit',
  'balance',
] as const;

export type TransactionColumnId = (typeof transactionColumnIds)[number];
export type TransactionColumnWidth = number | 'flex';
export type TransactionColumnWidths = Partial<
  Record<TransactionColumnId, number>
>;

const defaultWidths: Record<TransactionColumnId, TransactionColumnWidth> = {
  date: 110,
  account: 'flex',
  payee: 'flex',
  notes: 'flex',
  category: 'flex',
  debit: 100,
  credit: 100,
  balance: 103,
};

const minimumWidths: Record<TransactionColumnId, number> = {
  date: 80,
  account: 100,
  payee: 120,
  notes: 120,
  category: 120,
  debit: 90,
  credit: 90,
  balance: 90,
};

export function getVisibleTransactionColumns({
  showAccount,
  showBalance,
}: {
  showAccount: boolean;
  showBalance: boolean;
}): TransactionColumnId[] {
  return transactionColumnIds.filter(
    column =>
      (column !== 'account' || showAccount) &&
      (column !== 'balance' || showBalance),
  );
}

export function getTransactionColumnWidth(
  column: TransactionColumnId,
  widths: TransactionColumnWidths,
): TransactionColumnWidth {
  return widths[column] ?? defaultWidths[column];
}

export function getTransactionColumnMinimumWidth(
  column: TransactionColumnId,
): number {
  return minimumWidths[column];
}

export function sanitizeTransactionColumnWidths(
  widths: unknown,
): TransactionColumnWidths {
  if (widths == null || typeof widths !== 'object' || Array.isArray(widths)) {
    return {};
  }

  return transactionColumnIds.reduce<TransactionColumnWidths>((result, key) => {
    const width = Object.entries(widths).find(([name]) => name === key)?.[1];
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      result[key] = width;
    }
    return result;
  }, {});
}

export function constrainTransactionColumnWidth({
  column,
  requestedWidth,
  widths,
  visibleColumns,
  availableWidth,
  fixedWidth,
}: {
  column: TransactionColumnId;
  requestedWidth: number;
  widths: TransactionColumnWidths;
  visibleColumns: TransactionColumnId[];
  availableWidth: number;
  fixedWidth: number;
}): number {
  const otherColumnsMinimumWidth = visibleColumns
    .filter(id => id !== column)
    .reduce((total, id) => {
      const width = getTransactionColumnWidth(id, widths);
      return (
        total +
        (typeof width === 'number'
          ? Math.max(width, minimumWidths[id])
          : minimumWidths[id])
      );
    }, 0);
  const maximumWidth = Math.max(
    minimumWidths[column],
    availableWidth - fixedWidth - otherColumnsMinimumWidth,
  );

  return Math.round(
    Math.min(maximumWidth, Math.max(minimumWidths[column], requestedWidth)),
  );
}

export function getResizedAdjacentColumnWidths({
  leftColumn,
  rightColumn,
  requestedLeftWidth,
  leftStartWidth,
  rightStartWidth,
}: {
  leftColumn: TransactionColumnId;
  rightColumn: TransactionColumnId;
  requestedLeftWidth: number;
  leftStartWidth: number;
  rightStartWidth: number;
}): TransactionColumnWidths {
  const totalWidth = Math.max(
    minimumWidths[leftColumn] + minimumWidths[rightColumn],
    leftStartWidth + rightStartWidth,
  );
  const leftWidth = Math.round(
    Math.min(
      totalWidth - minimumWidths[rightColumn],
      Math.max(minimumWidths[leftColumn], requestedLeftWidth),
    ),
  );

  return {
    [leftColumn]: leftWidth,
    [rightColumn]: totalWidth - leftWidth,
  };
}
