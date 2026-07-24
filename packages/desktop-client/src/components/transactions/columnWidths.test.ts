import { describe, expect, it } from 'vitest';

import {
  constrainTransactionColumnWidth,
  getResizedAdjacentColumnWidths,
  getTransactionColumnWidth,
  getVisibleTransactionColumns,
  sanitizeTransactionColumnWidths,
} from './columnWidths';

describe('transaction column widths', () => {
  it('uses the existing layout defaults when no override is stored', () => {
    expect(getTransactionColumnWidth('date', {})).toBe(110);
    expect(getTransactionColumnWidth('payee', {})).toBe('flex');
  });

  it('only includes optional columns when they are visible', () => {
    expect(
      getVisibleTransactionColumns({ showAccount: false, showBalance: false }),
    ).not.toContain('account');
    expect(
      getVisibleTransactionColumns({ showAccount: true, showBalance: true }),
    ).toEqual(expect.arrayContaining(['account', 'balance']));
  });

  it('drops malformed saved widths', () => {
    expect(
      sanitizeTransactionColumnWidths({
        date: 140,
        payee: 'wide',
        unknown: 300,
        notes: -1,
      }),
    ).toEqual({ date: 140 });
  });

  it('keeps a resized column within its available bounds', () => {
    const visibleColumns = getVisibleTransactionColumns({
      showAccount: false,
      showBalance: false,
    });

    expect(
      constrainTransactionColumnWidth({
        column: 'payee',
        requestedWidth: 10,
        widths: {},
        visibleColumns,
        availableWidth: 1000,
        fixedWidth: 70,
      }),
    ).toBe(120);
    expect(
      constrainTransactionColumnWidth({
        column: 'payee',
        requestedWidth: 900,
        widths: {},
        visibleColumns,
        availableWidth: 800,
        fixedWidth: 70,
      }),
    ).toBe(180);
  });

  it('resizes only the two columns adjacent to a divider', () => {
    expect(
      getResizedAdjacentColumnWidths({
        leftColumn: 'notes',
        rightColumn: 'category',
        requestedLeftWidth: 250,
        leftStartWidth: 180,
        rightStartWidth: 220,
      }),
    ).toEqual({ notes: 250, category: 150 });
    expect(
      getResizedAdjacentColumnWidths({
        leftColumn: 'notes',
        rightColumn: 'category',
        requestedLeftWidth: 350,
        leftStartWidth: 180,
        rightStartWidth: 220,
      }),
    ).toEqual({ notes: 280, category: 120 });
  });
});
