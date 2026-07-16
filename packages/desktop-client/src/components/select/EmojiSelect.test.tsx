import { forwardRef } from 'react';
import type { FocusEvent, ReactNode } from 'react';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { TestProviders } from '#mocks';

import { EmojiSelect } from './EmojiSelect';

vi.mock('@emoji-mart/data', () => ({
  default: {
    emojis: {
      grinning: {
        id: 'grinning',
        name: 'Grinning Face',
        keywords: ['face', 'grin', 'smile', 'happy'],
        skins: [{ native: '😀' }],
      },
      '100': {
        id: '100',
        name: 'Hundred Points',
        keywords: ['100', 'hundred', 'points', 'score'],
        skins: [{ native: '💯' }],
      },
      large_blue_circle: {
        id: 'large_blue_circle',
        name: 'Blue Circle',
        keywords: ['blue', 'circle'],
        skins: [{ native: '🔵' }],
      },
      thumbs_up: {
        id: 'thumbs_up',
        name: 'Thumbs Up',
        keywords: ['thumbs', 'up', 'like', 'yes'],
        skins: [{ native: '👍' }],
      },
      red_circle: {
        id: 'red_circle',
        name: 'Red Circle',
        keywords: ['red', 'circle'],
        skins: [{ native: '🔴' }],
      },
      green_circle: {
        id: 'green_circle',
        name: 'Green Circle',
        keywords: ['green', 'circle'],
        skins: [{ native: '🟢' }],
      },
      yellow_circle: {
        id: 'yellow_circle',
        name: 'Yellow Circle',
        keywords: ['yellow', 'circle'],
        skins: [{ native: '🟡' }],
      },
      purple_circle: {
        id: 'purple_circle',
        name: 'Purple Circle',
        keywords: ['purple', 'circle'],
        skins: [{ native: '🟣' }],
      },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  Trans: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('react-aria-components', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Button: (props: Record<string, unknown>) => {
      const { children, onPress, ...rest } = props;
      return (
        <button onClick={onPress as () => void} {...rest}>
          {children as ReactNode}
        </button>
      );
    },
  };
});

vi.mock('@actual-app/components/button', () => ({
  Button: ({
    children,
    onPress,
    ...props
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => (
    <button onClick={onPress} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@actual-app/components/input', () => ({
  Input: forwardRef<HTMLInputElement, Record<string, unknown>>((props, ref) => {
    const {
      onBlur,
      onFocus,
      onKeyUp,
      onKeyDown,
      onChange,
      onUpdate,
      onEnter,
      onEscape,
      onChangeValue,
      ...rest
    } = props;
    return (
      <input
        ref={ref}
        {...rest}
        onBlur={e => {
          if (typeof onUpdate === 'function') {
            onUpdate(e.currentTarget.value, e);
          }
          if (typeof onBlur === 'function') {
            onBlur(e);
          }
        }}
        onFocus={e => {
          if (typeof onFocus === 'function') {
            onFocus(e);
          }
        }}
        onKeyUp={e => {
          if (typeof onKeyUp === 'function') {
            onKeyUp(e);
          }
          if (e.key === 'Enter' && typeof onEnter === 'function') {
            onEnter(e.currentTarget.value, e);
          }
          if (e.key === 'Escape' && typeof onEscape === 'function') {
            onEscape(e.currentTarget.value, e);
          }
        }}
        onKeyDown={e => {
          if (typeof onKeyDown === 'function') {
            onKeyDown(e);
          }
        }}
        onChange={e => {
          if (typeof onChangeValue === 'function') {
            onChangeValue(e.currentTarget.value, e);
          }
          if (typeof onChange === 'function') {
            onChange(e);
          }
        }}
      />
    );
  }),
}));

vi.mock('@actual-app/components/popover', () => ({
  Popover: ({
    children,
    isOpen,
    onOpenChange,
    triggerRef,
    isNonModal,
    ...props
  }: {
    children: ReactNode;
    isOpen: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    triggerRef?: unknown;
    isNonModal?: boolean;
    [key: string]: unknown;
  }) => {
    if (!isOpen) {
      return null;
    }
    const propsObj = props as {
      onBlur?: (e: FocusEvent<HTMLDivElement>) => void;
    };
    return (
      <div
        data-testid="emoji-select-popover"
        {...props}
        onBlur={e => {
          // For non-modal popovers, close when focus leaves
          if (isNonModal && onOpenChange) {
            const relatedTarget = e.relatedTarget as Node | null;
            const popoverElement = e.currentTarget;
            if (
              relatedTarget &&
              !popoverElement.contains(relatedTarget) &&
              triggerRef &&
              typeof triggerRef === 'object' &&
              triggerRef !== null &&
              'current' in triggerRef &&
              triggerRef.current &&
              !(triggerRef.current as Node).contains(relatedTarget)
            ) {
              onOpenChange(false);
            }
          }
          if (typeof propsObj.onBlur === 'function') {
            propsObj.onBlur(e);
          }
        }}
      >
        {children}
      </div>
    );
  },
}));

describe('EmojiSelect', () => {
  const defaultProps = {
    value: null,
    onSelect: vi.fn(),
    inputProps: {
      onBlur: vi.fn(),
      onKeyDown: vi.fn(),
      style: {},
    },
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the flag input when closed', () => {
    render(<EmojiSelect {...defaultProps} />, { wrapper: TestProviders });

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('opens picker when isOpen is true', () => {
    render(<EmojiSelect {...defaultProps} isOpen />, {
      wrapper: TestProviders,
    });

    expect(screen.getByTestId('emoji-select-popover')).toBeInTheDocument();
  });

  it('displays emoji when value is set', () => {
    render(<EmojiSelect {...defaultProps} value=":grinning:" />, {
      wrapper: TestProviders,
    });

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('😀');
  });

  it('calls onSelect when emoji is clicked', async () => {
    const onSelect = vi.fn();
    render(<EmojiSelect {...defaultProps} isOpen onSelect={onSelect} />, {
      wrapper: TestProviders,
    });

    await waitFor(() => {
      expect(screen.getByText('😀')).toBeInTheDocument();
    });

    const emojiButton = screen.getByText('😀').closest('button');
    expect(emojiButton).toBeInTheDocument();

    await userEvent.click(emojiButton!);

    expect(onSelect).toHaveBeenCalledWith(':grinning:');
  });

  it('calls onSelect with null when remove button is clicked', async () => {
    const onSelect = vi.fn();
    render(
      <EmojiSelect
        {...defaultProps}
        isOpen
        value=":grinning:"
        onSelect={onSelect}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      const removeButton = screen.getByText('Remove');
      expect(removeButton).toBeInTheDocument();
    });

    const removeButton = screen.getByText('Remove');
    await userEvent.click(removeButton);

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('filters emojis when search query is entered', async () => {
    render(<EmojiSelect {...defaultProps} isOpen />, {
      wrapper: TestProviders,
    });

    await waitFor(() => {
      expect(screen.getByTestId('emoji-select-popover')).toBeInTheDocument();
    });

    expect(screen.getByText('😀')).toBeInTheDocument();
    expect(screen.getByText('💯')).toBeInTheDocument();
    expect(screen.getByText('🔵')).toBeInTheDocument();
    expect(screen.getByText('👍')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('large_blue_circle');

    await waitFor(() => {
      expect(screen.getByText('🔵')).toBeInTheDocument();
      expect(screen.queryByText('💯')).not.toBeInTheDocument();
      expect(screen.queryByText('😀')).not.toBeInTheDocument();
      expect(screen.queryByText('👍')).not.toBeInTheDocument();
    });

    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('{Backspace}');

    await waitFor(
      () => {
        expect(screen.getByText('😀')).toBeInTheDocument();
        expect(screen.getByText('💯')).toBeInTheDocument();
        expect(screen.getByText('🔵')).toBeInTheDocument();
        expect(screen.getByText('👍')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('normalizes search query by removing colons and converting underscores to spaces', async () => {
    render(<EmojiSelect {...defaultProps} isOpen />, {
      wrapper: TestProviders,
    });

    await waitFor(() => {
      expect(screen.getByTestId('emoji-select-popover')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await userEvent.click(input);

    await userEvent.keyboard('thumbs up');
    await waitFor(() => {
      expect(screen.getByText('👍')).toBeInTheDocument();
      expect(screen.queryByText('🔵')).not.toBeInTheDocument();
    });

    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('thumbsup');
    await waitFor(() => {
      expect(screen.getByText('👍')).toBeInTheDocument();
      expect(screen.queryByText('🔵')).not.toBeInTheDocument();
    });

    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('thumbs_up');
    await waitFor(() => {
      expect(screen.getByText('👍')).toBeInTheDocument();
      expect(screen.queryByText('🔵')).not.toBeInTheDocument();
    });

    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard(':thumbs_up:');
    await waitFor(() => {
      expect(screen.getByText('👍')).toBeInTheDocument();
      expect(screen.queryByText('🔵')).not.toBeInTheDocument();
    });

    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard(':thumbs:up:');
    await waitFor(() => {
      expect(screen.getByText('👍')).toBeInTheDocument();
      expect(screen.queryByText('🔵')).not.toBeInTheDocument();
    });

    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('::thumbs_up::');
    await waitFor(() => {
      expect(screen.getByText('👍')).toBeInTheDocument();
      expect(screen.queryByText('🔵')).not.toBeInTheDocument();
    });
  });

  it('handles keyboard navigation with arrow keys', async () => {
    const onSelect = vi.fn();
    render(
      <EmojiSelect
        {...defaultProps}
        isOpen
        onSelect={onSelect}
        inputProps={{
          ...defaultProps.inputProps,
        }}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(screen.getByTestId('emoji-select-popover')).toBeInTheDocument();
    });

    const emojiButtons = screen
      .getAllByRole('button')
      .filter(button => button.hasAttribute('data-emoji-index'));

    expect(emojiButtons.length).toBeGreaterThan(0);

    const input = screen.getByRole('textbox');

    await userEvent.click(input);
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalled();
    const callArgs = onSelect.mock.calls[0][0];
    expect(callArgs).toMatch(/^:[a-z0-9_]+:$/);
  });

  it('closes picker on Escape key', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <EmojiSelect {...defaultProps} isOpen onSelect={onSelect} />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(screen.getByTestId('emoji-select-popover')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '{Escape}');

    rerender(
      <EmojiSelect {...defaultProps} isOpen={false} onSelect={onSelect} />,
    );

    expect(
      screen.queryByTestId('emoji-select-popover'),
    ).not.toBeInTheDocument();
  });

  it('displays placeholder flag icon when value is null', () => {
    render(<EmojiSelect {...defaultProps} value={null} />, {
      wrapper: TestProviders,
    });

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('handles embedded mode correctly', async () => {
    render(<EmojiSelect {...defaultProps} embedded />, {
      wrapper: TestProviders,
    });

    // In embedded mode, the picker should be open by default
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });
  });

  it('converts shortcode value to native emoji for display', () => {
    render(<EmojiSelect {...defaultProps} value=":100:" />, {
      wrapper: TestProviders,
    });

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('💯');
  });

  it('renders up to 7 recent flags in desktop mode', async () => {
    const { container } = render(
      <EmojiSelect
        {...defaultProps}
        isOpen
        recentFlags={[
          ':grinning:',
          ':100:',
          ':large_blue_circle:',
          ':thumbs_up:',
          ':red_circle:',
          ':green_circle:',
          ':yellow_circle:',
          ':purple_circle:',
        ]}
        recentFlagsLimit={7}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('emoji-select-recent-flags'),
      ).toBeInTheDocument();
    });

    expect(
      container.querySelectorAll('button[data-recent-emoji-index]'),
    ).toHaveLength(7);
    expect(
      within(screen.getByTestId('emoji-select-recent-flags')).queryByLabelText(
        'Purple Circle emoji (purple_circle)',
      ),
    ).not.toBeInTheDocument();
  });

  it('renders up to 6 recent flags in embedded mode', async () => {
    const { container } = render(
      <EmojiSelect
        {...defaultProps}
        embedded
        recentFlags={[
          ':grinning:',
          ':100:',
          ':large_blue_circle:',
          ':thumbs_up:',
          ':red_circle:',
          ':green_circle:',
          ':yellow_circle:',
        ]}
        recentFlagsLimit={6}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('emoji-select-recent-flags'),
      ).toBeInTheDocument();
    });

    expect(
      container.querySelectorAll('button[data-recent-emoji-index]'),
    ).toHaveLength(6);
    expect(
      within(screen.getByTestId('emoji-select-recent-flags')).queryByLabelText(
        'Yellow Circle emoji (yellow_circle)',
      ),
    ).not.toBeInTheDocument();
  });

  it('hides recent flags while searching', async () => {
    render(
      <EmojiSelect
        {...defaultProps}
        isOpen
        recentFlags={[':large_blue_circle:']}
        recentFlagsLimit={7}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('emoji-select-recent-flags'),
      ).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('large_blue_circle');

    await waitFor(() => {
      expect(
        screen.queryByTestId('emoji-select-recent-flags'),
      ).not.toBeInTheDocument();
    });
  });

  it('selects a recent flag by shortcode', async () => {
    const onSelect = vi.fn();

    render(
      <EmojiSelect
        {...defaultProps}
        isOpen
        recentFlags={[':large_blue_circle:']}
        recentFlagsLimit={7}
        onSelect={onSelect}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('emoji-select-recent-flags'),
      ).toBeInTheDocument();
    });

    await userEvent.click(
      within(screen.getByTestId('emoji-select-recent-flags')).getByText('🔵'),
    );

    expect(onSelect).toHaveBeenCalledWith(':large_blue_circle:');
  });

  it('does not duplicate recent flags in the unsearched main grid', async () => {
    render(
      <EmojiSelect
        {...defaultProps}
        isOpen
        recentFlags={[':large_blue_circle:']}
        recentFlagsLimit={7}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('emoji-select-recent-flags'),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText('🔵')).toHaveLength(1);
  });

  it('includes recent flags in searched results', async () => {
    render(
      <EmojiSelect
        {...defaultProps}
        isOpen
        recentFlags={[':large_blue_circle:']}
        recentFlagsLimit={7}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('emoji-select-recent-flags'),
      ).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('large_blue_circle');

    await waitFor(() => {
      expect(screen.queryByTestId('emoji-select-recent-flags')).toBeNull();
      expect(screen.getByText('🔵')).toBeInTheDocument();
    });
  });

  it('renders section headers for recent and regular flags', async () => {
    render(
      <EmojiSelect
        {...defaultProps}
        isOpen
        recentFlags={[':large_blue_circle:']}
        recentFlagsLimit={7}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(screen.getByText('RECENTLY USED')).toBeInTheDocument();
      expect(screen.getByText('FLAGS')).toBeInTheDocument();
    });

    expect(
      screen
        .getByText('RECENTLY USED')
        .compareDocumentPosition(screen.getByText('FLAGS')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
