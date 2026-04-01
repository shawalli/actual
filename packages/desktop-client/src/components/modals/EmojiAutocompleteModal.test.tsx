import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { EmojiAutocompleteModal } from './EmojiAutocompleteModal';

import { TestProviders } from '@desktop-client/mocks';

// Mock EmojiSelect so the test focuses on the modal shell, not the picker
vi.mock('@desktop-client/components/select/EmojiSelect', () => ({
  EmojiSelect: ({ onSelect }: { onSelect: (emoji: string | null) => void }) => (
    <button data-testid="mock-emoji-select" onClick={() => onSelect('🔵')}>
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

  function renderModal() {
    return render(
      <TestProviders>
        <EmojiAutocompleteModal onSelect={onSelect} onClose={onClose} />
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
});
