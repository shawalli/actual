import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { useLocalPref } from '#hooks/useLocalPref';
import { TestProviders } from '#mocks';

import { ResetTransactionColumnWidths } from './Reset';

vi.mock('#hooks/useLocalPref', () => ({
  useLocalPref: vi.fn(),
}));

describe('ResetTransactionColumnWidths', () => {
  it('removes the stored transaction column widths', () => {
    const removeColumnWidths = vi.fn();
    vi.mocked(useLocalPref).mockReturnValue([
      undefined,
      vi.fn(),
      removeColumnWidths,
    ]);

    render(<ResetTransactionColumnWidths />, { wrapper: TestProviders });

    fireEvent.click(screen.getByRole('button', { name: 'Reset columns' }));

    expect(useLocalPref).toHaveBeenCalledWith('transactions.columnWidths');
    expect(removeColumnWidths).toHaveBeenCalledOnce();
  });
});
