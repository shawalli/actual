import { describe, expect, it } from 'vitest';

import {
  constrainTransactionColumnWidth,
  fillTrailingTransactionColumn,
  fitTransactionColumnWidths,
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

  it('fits stored widths into a narrower viewport without changing flex columns', () => {
    expect(
      fitTransactionColumnWidths({
        widths: { notes: 400, category: 400 },
        visibleColumns: ['notes', 'category', 'payee'],
        availableWidth: 520,
        fixedWidth: 0,
      }),
    ).toEqual({ notes: 200, category: 200 });
  });

  it('scales a fully saved layout proportionally to fill a wider viewport', () => {
    expect(
      fitTransactionColumnWidths({
        widths: { date: 110, payee: 200, notes: 200 },
        visibleColumns: ['date', 'payee', 'notes'],
        availableWidth: 1000,
        fixedWidth: 70,
      }),
    ).toEqual({ date: 200, payee: 364, notes: 366 });
  });

  it('leaves saved widths unchanged when flexible columns can fill the viewport', () => {
    expect(
      fitTransactionColumnWidths({
        widths: { date: 110 },
        visibleColumns: ['date', 'payee', 'notes'],
        availableWidth: 1000,
        fixedWidth: 70,
      }),
    ).toEqual({ date: 110 });
  });

  it('does not treat an unsaved fixed default as a flexible column', () => {
    expect(
      fitTransactionColumnWidths({
        widths: {
          payee: 198,
          notes: 425,
          category: 172,
          debit: 100,
          credit: 90,
        },
        visibleColumns: [
          'date',
          'payee',
          'notes',
          'category',
          'debit',
          'credit',
        ],
        availableWidth: 906,
        fixedWidth: 70,
      }),
    ).toEqual({
      date: 93,
      payee: 155,
      notes: 258,
      category: 143,
      debit: 94,
      credit: 93,
    });
  });

  it('uses the trailing data column to fill remaining space when needed', () => {
    expect(
      fillTrailingTransactionColumn({
        widths: { date: 110, payee: 200, notes: 200 },
        visibleColumns: ['date', 'payee', 'notes'],
      }),
    ).toEqual({ date: 110, payee: 200, notes: 'flex' });
  });
});
