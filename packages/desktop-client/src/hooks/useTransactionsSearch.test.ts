import { q } from '@actual-app/core/shared/query';

import * as queries from '#queries';

import { getMobileFlagSearchTerms } from './useTransactionsSearch';

describe('getMobileFlagSearchTerms', () => {
  it('normalizes native emoji to stored flag shortcode values', () => {
    expect(getMobileFlagSearchTerms('🔵')).toEqual([':large_blue_circle:']);
    expect(getMobileFlagSearchTerms('movies 🔵')).toEqual([
      ':large_blue_circle:',
    ]);
  });

  it('keeps colon-style shortcodes as stored flag shortcode values', () => {
    expect(getMobileFlagSearchTerms(':large_blue_circle:')).toEqual([
      ':large_blue_circle:',
    ]);
  });

  it('does not turn regular search text into flag search terms', () => {
    expect(getMobileFlagSearchTerms('kroger')).toEqual([]);
  });
});

describe('transactionsSearch flag terms', () => {
  it('adds an optional flag predicate when mobile search passes flag terms', () => {
    const query = queries.transactionsSearch(
      q('transactions'),
      '🔵',
      'MM/dd/yyyy',
      [':large_blue_circle:'],
    );

    expect(JSON.stringify(query.serialize())).toContain(
      '"flag":{"$oneof":[":large_blue_circle:"]}',
    );
  });
});
