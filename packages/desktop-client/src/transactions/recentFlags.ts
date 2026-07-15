import { useCallback } from 'react';

import { useLocalPref } from '#hooks/useLocalPref';

export const DESKTOP_RECENT_FLAGS_LIMIT = 7;
export const MOBILE_RECENT_FLAGS_LIMIT = 6;
export const RECENT_FLAGS_SEED_TRANSACTION_LIMIT = 100;

type TransactionWithFlag = {
  flag?: string | null;
};

function isValidFlag(flag: unknown): flag is string {
  return typeof flag === 'string' && flag.length > 0;
}

export function normalizeRecentFlags(
  flags: readonly unknown[] | null | undefined,
  limit: number,
): string[] {
  if (limit <= 0) {
    return [];
  }

  if (!Array.isArray(flags)) {
    return [];
  }

  const normalizedFlags: string[] = [];
  const seenFlags = new Set<string>();

  for (const flag of flags) {
    if (!isValidFlag(flag) || seenFlags.has(flag)) {
      continue;
    }

    seenFlags.add(flag);
    normalizedFlags.push(flag);

    if (normalizedFlags.length >= limit) {
      break;
    }
  }

  return normalizedFlags;
}

export function addRecentFlag(
  flags: readonly unknown[] | null | undefined,
  selectedFlag: string | null | undefined,
  limit: number,
): string[] {
  const currentFlags = normalizeRecentFlags(flags, limit);

  if (!isValidFlag(selectedFlag)) {
    return currentFlags;
  }

  return [
    selectedFlag,
    ...currentFlags.filter(flag => flag !== selectedFlag),
  ].slice(0, limit);
}

export function seedRecentFlagsFromFlagValues(
  flagValues: Iterable<string | null | undefined>,
  limit: number,
  transactionLimit = RECENT_FLAGS_SEED_TRANSACTION_LIMIT,
): string[] {
  const recentFlags: string[] = [];
  const seenFlags = new Set<string>();
  const flagIterator = flagValues[Symbol.iterator]();
  let scannedCount = 0;

  while (scannedCount < transactionLimit && recentFlags.length < limit) {
    const nextFlag = flagIterator.next();
    if (nextFlag.done) {
      break;
    }
    const flag = nextFlag.value;
    scannedCount += 1;

    if (!isValidFlag(flag) || seenFlags.has(flag)) {
      continue;
    }

    seenFlags.add(flag);
    recentFlags.push(flag);
  }

  return recentFlags;
}

export function seedRecentFlagsFromTransactions(
  transactions: Iterable<TransactionWithFlag>,
  limit: number,
  transactionLimit = RECENT_FLAGS_SEED_TRANSACTION_LIMIT,
): string[] {
  function* flags() {
    for (const transaction of transactions) {
      yield transaction.flag;
    }
  }

  return seedRecentFlagsFromFlagValues(flags(), limit, transactionLimit);
}

export function useRecentTransactionFlags(limit: number) {
  const [storedRecentFlags, setStoredRecentFlags, removeStoredRecentFlags] =
    useLocalPref('transactions.recentFlags');

  const recentFlags = normalizeRecentFlags(storedRecentFlags, limit);

  const saveRecentFlags = useCallback(
    (flags: readonly unknown[]) => {
      setStoredRecentFlags(normalizeRecentFlags(flags, limit));
    },
    [limit, setStoredRecentFlags],
  );

  const recordRecentFlag = useCallback(
    (flag: string | null | undefined) => {
      setStoredRecentFlags(addRecentFlag(storedRecentFlags, flag, limit));
    },
    [limit, setStoredRecentFlags, storedRecentFlags],
  );

  return {
    recentFlags,
    hasStoredRecentFlags: storedRecentFlags !== undefined,
    saveRecentFlags,
    recordRecentFlag,
    removeStoredRecentFlags,
  };
}
