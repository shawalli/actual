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
export type TransactionColumnRenderWidths = Partial<
  Record<TransactionColumnId, TransactionColumnWidth>
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
  widths: TransactionColumnRenderWidths,
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

export function fitTransactionColumnWidths({
  widths,
  visibleColumns,
  availableWidth,
  fixedWidth,
}: {
  widths: TransactionColumnWidths;
  visibleColumns: TransactionColumnId[];
  availableWidth: number;
  fixedWidth: number;
}): TransactionColumnWidths {
  if (availableWidth <= 0) return widths;

  const numericColumns = visibleColumns.filter(
    column => typeof widths[column] === 'number',
  );
  const flexibleMinimumWidth = visibleColumns
    .filter(column => typeof widths[column] !== 'number')
    .reduce((total, column) => total + minimumWidths[column], 0);
  const totalMinimumWidth = numericColumns.reduce(
    (total, column) => total + minimumWidths[column],
    0,
  );
  const targetNumericWidth = Math.max(
    totalMinimumWidth,
    availableWidth - fixedWidth - flexibleMinimumWidth,
  );
  const currentNumericWidth = numericColumns.reduce(
    (total, column) => total + Math.max(widths[column]!, minimumWidths[column]),
    0,
  );

  if (targetNumericWidth >= currentNumericWidth) return widths;

  const currentExtraWidth = currentNumericWidth - totalMinimumWidth;
  const targetExtraWidth = targetNumericWidth - totalMinimumWidth;
  const result = { ...widths };
  let remainingWidth = targetNumericWidth;

  for (const [index, column] of numericColumns.entries()) {
    const currentWidth = Math.max(widths[column]!, minimumWidths[column]);
    const width =
      index === numericColumns.length - 1
        ? remainingWidth
        : Math.round(
            minimumWidths[column] +
              (currentWidth - minimumWidths[column]) *
                (targetExtraWidth / currentExtraWidth),
          );
    result[column] = width;
    remainingWidth -= width;
  }

  return result;
}

export function fillTrailingTransactionColumn({
  widths,
  visibleColumns,
}: {
  widths: TransactionColumnWidths;
  visibleColumns: TransactionColumnId[];
}): TransactionColumnRenderWidths {
  if (
    visibleColumns.some(
      column => getTransactionColumnWidth(column, widths) === 'flex',
    )
  ) {
    return widths;
  }

  const trailingColumn = visibleColumns.at(-1);
  return trailingColumn ? { ...widths, [trailingColumn]: 'flex' } : widths;
}
