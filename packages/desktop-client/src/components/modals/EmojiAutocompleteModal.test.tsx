import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { TestProviders } from '#mocks';

import { EmojiAutocompleteModal } from './EmojiAutocompleteModal';

// Mock EmojiSelect so the test focuses on the modal shell, not the picker
vi.mock('#components/select/EmojiSelect', () => ({
  EmojiSelect: ({
    onSelect,
    recentFlags,
    recentFlagsLimit,
  }: {
    onSelect: (emoji: string | null) => void;
    recentFlags?: string[];
    recentFlagsLimit?: number;
  }) => (
    <button
      data-testid="mock-emoji-select"
      data-recent-flags={JSON.stringify(recentFlags ?? [])}
      data-recent-flags-limit={recentFlagsLimit ?? ''}
      onClick={() => onSelect('🔵')}
    >
      Select Emoji
    </button>
  ),
}));

describe('EmojiAutocompleteModal', () => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(
    props: Partial<ComponentProps<typeof EmojiAutocompleteModal>> = {},
  ) {
    return render(
      <TestProviders>
        <EmojiAutocompleteModal
          onSelect={onSelect}
          onClose={onClose}
          {...props}
        />
      </TestProviders>,
    );
  }

  it('renders the emoji selector', () => {
    renderModal();
    expect(screen.getByTestId('mock-emoji-select')).toBeInTheDocument();
  });

  it('calls onSelect with the chosen emoji when one is selected', async () => {
    renderModal();
    await userEvent.click(screen.getByTestId('mock-emoji-select'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('🔵');
  });

  it('passes recent flags to emoji selector', () => {
    renderModal({
      recentFlags: [':100:'],
      recentFlagsLimit: 7,
    });

    const emojiSelect = screen.getByTestId('mock-emoji-select');
    expect(emojiSelect).toHaveAttribute('data-recent-flags', '[":100:"]');
    expect(emojiSelect).toHaveAttribute('data-recent-flags-limit', '7');
  });
});
