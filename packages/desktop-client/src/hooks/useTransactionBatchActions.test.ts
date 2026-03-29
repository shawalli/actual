import React from 'react';
import { Provider } from 'react-redux';

import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';

import { send } from 'loot-core/platform/client/connection';
import type { TransactionEntity } from 'loot-core/types/models';

import { useTransactionBatchActions } from './useTransactionBatchActions';

import {
  configureTestAppStore,
  createTestQueryClient,
} from '@desktop-client/mocks';
import { aqlQuery } from '@desktop-client/queries/aqlQuery';

vi.mock('loot-core/platform/client/connection', () => ({
  send: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@desktop-client/queries/aqlQuery', () => ({
  aqlQuery: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSend = vi.mocked(send);
const mockAqlQuery = vi.mocked(aqlQuery);

function makeTransaction(
  overrides: Partial<TransactionEntity> = {},
): TransactionEntity {
  return {
    id: 'tx-1',
    account: 'account-1',
    date: '2025-01-01',
    amount: -1000,
    payee: null,
    notes: null,
    category: null,
    reconciled: false,
    cleared: false,
    is_parent: false,
    is_child: false,
    flag: null,
    ...overrides,
  } as TransactionEntity;
}

function renderBatchActionsHook() {
  const queryClient = createTestQueryClient();
  const store = configureTestAppStore({ queryClient });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children);

  const hook = renderHook(() => useTransactionBatchActions(), { wrapper });
  return { hook, store };
}

describe('useTransactionBatchActions - flag bulk edit', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches emoji-autocomplete modal when bulk-editing flag', async () => {
    const tx = makeTransaction({ id: 'tx-1' });
    mockAqlQuery.mockResolvedValue({ data: [tx] });

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
      });
    });

    const { modalStack } = store.getState().modals;
    expect(modalStack).toHaveLength(1);
    expect(modalStack[0].name).toBe('emoji-autocomplete');
  });

  it('does not dispatch edit-field modal when bulk-editing flag', async () => {
    const tx = makeTransaction({ id: 'tx-1' });
    mockAqlQuery.mockResolvedValue({ data: [tx] });

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
      });
    });

    const { modalStack } = store.getState().modals;
    expect(modalStack.every(m => m.name !== 'edit-field')).toBe(true);
  });

  it('sets the flag on the parent but not on child transactions', async () => {
    // aqlQuery returns grouped: parent with one child in subtransactions
    const parent = makeTransaction({
      id: 'tx-parent',
      is_parent: true,
      subtransactions: [
        makeTransaction({
          id: 'tx-child',
          is_child: true,
          flag: null,
        }),
      ],
    } as Partial<TransactionEntity>);
    mockAqlQuery.mockResolvedValue({ data: [parent] });

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-parent', 'tx-child'],
      });
    });

    // Invoke the onSelect callback from the emoji-autocomplete modal
    const { modalStack } = store.getState().modals;
    const modal = modalStack[0];
    expect(modal.name).toBe('emoji-autocomplete');

    await act(async () => {
      await modal.options.onSelect(':red_circle:');
    });

    expect(mockSend).toHaveBeenCalledWith(
      'transactions-batch-update',
      expect.anything(),
    );
    const changes = mockSend.mock.calls[0][1];
    const updated: TransactionEntity[] = changes.updated ?? [];

    // Parent should have the new flag
    const updatedParent = updated.find(t => t.id === 'tx-parent');
    expect(updatedParent?.flag).toBe(':red_circle:');

    // Child may appear in updated (re-derived from parent), but must not
    // have the new flag set directly — its flag stays at its prior value
    const updatedChild = updated.find(t => t.id === 'tx-child');
    if (updatedChild) {
      expect(updatedChild.flag).not.toBe(':red_circle:');
    }
  });

  it('does not skip child transactions when bulk-editing a non-flag field', async () => {
    const parent = makeTransaction({
      id: 'tx-parent',
      is_parent: true,
      subtransactions: [
        makeTransaction({
          id: 'tx-child',
          is_child: true,
        }),
      ],
    } as Partial<TransactionEntity>);
    mockAqlQuery.mockResolvedValue({ data: [parent] });

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'notes',
        ids: ['tx-parent', 'tx-child'],
      });
    });

    // notes uses edit-field modal
    const { modalStack } = store.getState().modals;
    const modal = modalStack[0];
    expect(modal.name).toBe('edit-field');

    await act(async () => {
      await modal.options.onSubmit('notes', 'hello', 'replace');
    });

    const changes = mockSend.mock.calls[0][1];
    const updatedIds = (changes.updated ?? []).map(
      (t: TransactionEntity) => t.id,
    );
    expect(updatedIds).toContain('tx-parent');
    expect(updatedIds).toContain('tx-child');
  });

  it('shows reconciled-transaction confirmation modal before the emoji picker', async () => {
    const tx = makeTransaction({ id: 'tx-1', reconciled: true });
    mockAqlQuery.mockResolvedValue({ data: [tx] });

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
      });
    });

    const { modalStack } = store.getState().modals;
    expect(modalStack[0].name).toBe('confirm-transaction-edit');

    // After confirming, emoji-autocomplete should be pushed
    await act(async () => {
      await modalStack[0].options.onConfirm();
    });

    const updatedStack = store.getState().modals.modalStack;
    expect(updatedStack.some(m => m.name === 'emoji-autocomplete')).toBe(true);
  });
});
