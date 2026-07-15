import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { TestProviders } from '#mocks';

import { MobileFlagModal, sanitizeMobileFlagInput } from './MobileFlagModal';

vi.mock('@actual-app/core/shared/emoji', () => ({
  nativeToShortcode: (emoji: string | null) =>
    emoji === '🔵' ? ':large_blue_circle:' : emoji === '💯' ? ':100:' : emoji,
  shortcodeToNative: (shortcode: string | null) =>
    shortcode === ':large_blue_circle:'
      ? '🔵'
      : shortcode === ':100:'
        ? '💯'
        : shortcode || '',
}));

describe('sanitizeMobileFlagInput', () => {
  it('keeps only the first emoji-like grapheme', () => {
    expect(sanitizeMobileFlagInput('abc🔵😀')).toBe('🔵');
    expect(sanitizeMobileFlagInput('abc')).toBe('');
    expect(sanitizeMobileFlagInput('🇺🇸x')).toBe('🇺🇸');
  });
});

describe('MobileFlagModal', () => {
  it('saves the selected emoji as a shortcode', async () => {
    const onSave = vi.fn();
    render(
      <TestProviders>
        <MobileFlagModal value=":large_blue_circle:" onSave={onSave} />
      </TestProviders>,
    );

    await userEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledWith(':large_blue_circle:');
  });

  it('removes the flag', async () => {
    const onSave = vi.fn();
    render(
      <TestProviders>
        <MobileFlagModal value=":large_blue_circle:" onSave={onSave} />
      </TestProviders>,
    );

    await userEvent.click(screen.getByText('Remove'));

    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('shows recent flags between the input and buttons and applies selected recent flag', async () => {
    const onSave = vi.fn();
    render(
      <TestProviders>
        <MobileFlagModal
          value={null}
          recentFlags={[':100:', ':large_blue_circle:']}
          onSave={onSave}
        />
      </TestProviders>,
    );

    const input = screen.getByLabelText('Flag emoji');
    const recentFlags = screen.getByTestId('mobile-flag-recent-flags');
    expect(input.compareDocumentPosition(recentFlags)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(recentFlags.compareDocumentPosition(screen.getByText('Save'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await userEvent.click(screen.getByText('💯'));
    await userEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledWith(':100:');
  });
});
