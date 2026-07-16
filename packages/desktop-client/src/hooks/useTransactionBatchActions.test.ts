import { createElement } from 'react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { send } from '@actual-app/core/platform/client/connection';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';

import { configureTestAppStore, createTestQueryClient } from '#mocks';
import type { Modal } from '#modals/modalsSlice';
import { aqlQuery } from '#queries/aqlQuery';

import { useTransactionBatchActions } from './useTransactionBatchActions';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('#queries/aqlQuery', () => ({
  aqlQuery: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSend = vi.mocked(send);
const mockAqlQuery = vi.mocked(aqlQuery);
const recentFlagsStorageKey = 'undefined-transactions.recentFlags';

function makeQueryResult<T>(data: T) {
  return { data, dependencies: [] };
}

function mockNonReconciledBatchEditQueries(transactions: TransactionEntity[]) {
  mockAqlQuery
    .mockResolvedValueOnce(makeQueryResult(transactions))
    .mockResolvedValueOnce(makeQueryResult([]))
    .mockResolvedValueOnce(makeQueryResult(transactions));
}

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
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store, children });

  const hook = renderHook(() => useTransactionBatchActions(), { wrapper });
  return { hook, store };
}

function expectModal<N extends Modal['name']>(
  modal: Modal | undefined,
  name: N,
): asserts modal is Extract<Modal, { name: N }> {
  expect(modal?.name).toBe(name);
}

describe('useTransactionBatchActions - flag bulk edit', () => {
  beforeEach(() => {
    localStorage.removeItem(recentFlagsStorageKey);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches emoji-autocomplete modal when bulk-editing flag', async () => {
    const tx = makeTransaction({ id: 'tx-1' });
    mockNonReconciledBatchEditQueries([tx]);

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

  it('passes recent flags to emoji-autocomplete modal', async () => {
    localStorage.setItem(recentFlagsStorageKey, JSON.stringify([':100:']));
    const tx = makeTransaction({ id: 'tx-1' });
    mockNonReconciledBatchEditQueries([tx]);

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
      });
    });

    const { modalStack } = store.getState().modals;
    expectModal(modalStack[0], 'emoji-autocomplete');
    expect(modalStack[0].options.recentFlags).toEqual([':100:']);
    expect(modalStack[0].options.recentFlagsLimit).toBe(6);
  });

  it('dispatches mobile flag modal when requested for bulk-editing flag', async () => {
    const tx = makeTransaction({ id: 'tx-1' });
    mockNonReconciledBatchEditQueries([tx]);

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
        flagInputMode: 'mobile-flag',
      });
    });

    const { modalStack } = store.getState().modals;
    expect(modalStack).toHaveLength(1);
    expectModal(modalStack[0], 'mobile-flag');
    expect(modalStack[0].options.value).toBeNull();
    expect(modalStack[0].options.description).toBe(
      'Choose one emoji as a flag for the selected transactions.',
    );
    expect(modalStack[0].options.recentFlags).toEqual([]);
  });

  it('passes recent flags to mobile flag modal when requested for bulk-editing flag', async () => {
    localStorage.setItem(recentFlagsStorageKey, JSON.stringify([':100:']));
    const tx = makeTransaction({ id: 'tx-1' });
    mockNonReconciledBatchEditQueries([tx]);

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
        flagInputMode: 'mobile-flag',
      });
    });

    const { modalStack } = store.getState().modals;
    expectModal(modalStack[0], 'mobile-flag');
    expect(modalStack[0].options.recentFlags).toEqual([':100:']);
  });

  it('records recent flags when saving from mobile flag bulk edit', async () => {
    const tx = makeTransaction({ id: 'tx-1' });
    mockNonReconciledBatchEditQueries([tx]);

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
        flagInputMode: 'mobile-flag',
      });
    });

    const { modalStack } = store.getState().modals;
    const modal = modalStack[0];
    expectModal(modal, 'mobile-flag');

    await act(async () => {
      await modal.options.onSave(':large_blue_circle:');
    });

    expect(mockSend).toHaveBeenCalledWith(
      'transactions-batch-update',
      expect.anything(),
    );
    expect(
      JSON.parse(localStorage.getItem(recentFlagsStorageKey) ?? '[]'),
    ).toEqual([':large_blue_circle:']);
  });

  it('does not dispatch edit-field modal when bulk-editing flag', async () => {
    const tx = makeTransaction({ id: 'tx-1' });
    mockNonReconciledBatchEditQueries([tx]);

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

  it('sets the flag on explicitly selected parent and child transactions', async () => {
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
    mockNonReconciledBatchEditQueries([parent]);

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
    expectModal(modal, 'emoji-autocomplete');

    await act(async () => {
      modal.options.onSelect(':large_blue_circle:');
    });

    expect(mockSend).toHaveBeenCalledWith(
      'transactions-batch-update',
      expect.anything(),
    );
    const changes = mockSend.mock.calls[0][1];
    const updated: TransactionEntity[] = changes.updated ?? [];

    const updatedParent = updated.find(t => t.id === 'tx-parent');
    expect(updatedParent?.flag).toBe(':large_blue_circle:');

    expect(
      updated.some(
        t => t.id === 'tx-child' && t.flag === ':large_blue_circle:',
      ),
    ).toBe(true);
    expect(
      JSON.parse(localStorage.getItem(recentFlagsStorageKey) ?? '[]'),
    ).toEqual([':large_blue_circle:']);
  });

  it('does not update recent flags when bulk-clearing flags', async () => {
    localStorage.setItem(recentFlagsStorageKey, JSON.stringify([':100:']));
    const tx = makeTransaction({ id: 'tx-1', flag: ':100:' });
    mockNonReconciledBatchEditQueries([tx]);

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
      });
    });

    const { modalStack } = store.getState().modals;
    const modal = modalStack[0];
    expectModal(modal, 'emoji-autocomplete');

    await act(async () => {
      modal.options.onSelect(null);
    });

    expect(
      JSON.parse(localStorage.getItem(recentFlagsStorageKey) ?? '[]'),
    ).toEqual([':100:']);
  });

  it('does not edit fetched split children that were not explicitly selected', async () => {
    const parent = makeTransaction({
      id: 'tx-parent',
      is_parent: true,
      flag: null,
      subtransactions: [
        makeTransaction({
          id: 'tx-child',
          is_child: true,
          flag: ':orange_circle:',
        }),
      ],
    } as Partial<TransactionEntity>);
    mockNonReconciledBatchEditQueries([parent]);

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-parent'],
      });
    });

    const { modalStack } = store.getState().modals;
    const modal = modalStack[0];
    expectModal(modal, 'emoji-autocomplete');

    await act(async () => {
      modal.options.onSelect(':large_blue_circle:');
    });

    const changes = mockSend.mock.calls[0][1];
    const updated: TransactionEntity[] = changes.updated ?? [];

    expect(updated.find(t => t.id === 'tx-parent')?.flag).toBe(
      ':large_blue_circle:',
    );
    expect(
      updated.some(
        t => t.id === 'tx-child' && t.flag === ':large_blue_circle:',
      ),
    ).toBe(false);
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
    mockAqlQuery.mockResolvedValue(makeQueryResult([parent]));

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
    expectModal(modal, 'edit-field');

    await act(async () => {
      modal.options.onSubmit('notes', 'hello', 'replace');
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
    mockAqlQuery
      .mockResolvedValueOnce(makeQueryResult([tx]))
      .mockResolvedValueOnce(makeQueryResult([tx]));

    const { hook, store } = renderBatchActionsHook();

    await act(async () => {
      await hook.result.current.onBatchEdit({
        name: 'flag',
        ids: ['tx-1'],
      });
    });

    const { modalStack } = store.getState().modals;
    const modal = modalStack[0];
    expectModal(modal, 'confirm-transaction-edit');

    // After confirming, emoji-autocomplete should be pushed
    await act(async () => {
      modal.options.onConfirm();
    });

    const updatedStack = store.getState().modals.modalStack;
    expect(updatedStack.some(m => m.name === 'emoji-autocomplete')).toBe(true);
  });
});
