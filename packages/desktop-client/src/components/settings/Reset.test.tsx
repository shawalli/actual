import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { useLocalPref } from '#hooks/useLocalPref';
import { TestProviders } from '#mocks';

import { ResetTransactionColumnWidths } from './Reset';

vi.mock('#hooks/useLocalPref', () => ({
  useLocalPref: vi.fn(),
}));

describe('ResetTransactionColumnWidths', () => {
  it('removes the stored transaction column widths and shows a completion message', async () => {
    vi.useFakeTimers();
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
    expect(
      screen.queryByText('Transaction column widths reset.'),
    ).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(
      screen.getByText('Transaction column widths reset.'),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });
});
