import { useEffect, useMemo, useRef, useState } from 'react';

import { normalizeFlagToShortcode } from '@actual-app/core/shared/emoji';
import type { Query } from '@actual-app/core/shared/query';
import { debounce } from 'es-toolkit/compat';

import * as queries from '#queries';

type UseTransactionsSearchProps = {
  updateQuery: (updateFn: (searchQuery: Query) => Query) => void;
  resetQuery: () => void;
  dateFormat: string;
  delayMs?: number;
};
type UseTransactionsSearchResult = {
  isSearching: boolean;
  search: (searchText: string) => void;
};

function isFlagSearchCandidate(value: string) {
  return /[^\x00-\x7F]/u.test(value) || /^:[a-zA-Z0-9_+-]+:$/.test(value);
}

export function getMobileFlagSearchTerms(searchText: string) {
  const terms = new Set<string>();
  const trimmedSearchText = searchText.trim();

  if (
    !/\s/.test(trimmedSearchText) &&
    isFlagSearchCandidate(trimmedSearchText)
  ) {
    const normalizedSearchText = normalizeFlagToShortcode(trimmedSearchText);
    if (normalizedSearchText) {
      terms.add(normalizedSearchText);
    }
  }

  for (const token of trimmedSearchText.split(/\s+/)) {
    if (!isFlagSearchCandidate(token)) {
      continue;
    }

    const normalizedToken = normalizeFlagToShortcode(token);

    if (normalizedToken) {
      terms.add(normalizedToken);
    }
  }

  return Array.from(terms);
}

export function useTransactionsSearch({
  updateQuery,
  resetQuery,
  dateFormat,
  delayMs = 150,
}: UseTransactionsSearchProps): UseTransactionsSearchResult {
  const [isSearching, setIsSearching] = useState(false);

  const updateQueryRef = useRef(updateQuery);
  updateQueryRef.current = updateQuery;

  const resetQueryRef = useRef(resetQuery);
  resetQueryRef.current = resetQuery;

  const updateSearchQuery = useMemo(
    () =>
      debounce((searchText: string) => {
        if (searchText === '') {
          resetQueryRef.current?.();
          setIsSearching(false);
        } else if (searchText) {
          resetQueryRef.current?.();
          updateQueryRef.current(previousQuery =>
            queries.transactionsSearch(
              previousQuery,
              searchText,
              dateFormat,
              getMobileFlagSearchTerms(searchText),
            ),
          );
          setIsSearching(true);
        }
      }, delayMs),
    [dateFormat, delayMs],
  );

  useEffect(() => {
    return () => updateSearchQuery.cancel();
  }, [updateSearchQuery]);

  return {
    isSearching,
    search: updateSearchQuery,
  };
}
