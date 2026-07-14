import {
  addRecentFlag,
  DESKTOP_RECENT_FLAGS_LIMIT,
  normalizeRecentFlags,
  RECENT_FLAGS_SEED_TRANSACTION_LIMIT,
  seedRecentFlagsFromFlagValues,
  seedRecentFlagsFromTransactions,
} from './recentFlags';

describe('recent transaction flags', () => {
  describe('normalizeRecentFlags', () => {
    it('returns an empty list for missing or empty input', () => {
      expect(normalizeRecentFlags(undefined, DESKTOP_RECENT_FLAGS_LIMIT)).toEqual(
        [],
      );
      expect(normalizeRecentFlags(null, DESKTOP_RECENT_FLAGS_LIMIT)).toEqual([]);
      expect(normalizeRecentFlags([], DESKTOP_RECENT_FLAGS_LIMIT)).toEqual([]);
    });

    it('filters invalid values, removes duplicates, and trims to the limit', () => {
      expect(
        normalizeRecentFlags(
          [
            ':red_circle:',
            '',
            null,
            ':blue_circle:',
            ':red_circle:',
            ':green_circle:',
          ],
          2,
        ),
      ).toEqual([':red_circle:', ':blue_circle:']);
    });
  });

  describe('addRecentFlag', () => {
    it('moves an existing selected flag to the front', () => {
      expect(
        addRecentFlag(
          [':red_circle:', ':blue_circle:', ':green_circle:'],
          ':blue_circle:',
          DESKTOP_RECENT_FLAGS_LIMIT,
        ),
      ).toEqual([':blue_circle:', ':red_circle:', ':green_circle:']);
    });

    it('adds a new selected flag and trims to the supplied limit', () => {
      expect(
        addRecentFlag(
          [':red_circle:', ':blue_circle:', ':green_circle:'],
          ':yellow_circle:',
          3,
        ),
      ).toEqual([':yellow_circle:', ':red_circle:', ':blue_circle:']);
    });

    it('does not mutate the list when a flag is cleared', () => {
      const recentFlags = [':red_circle:', ':blue_circle:'];

      expect(addRecentFlag(recentFlags, null, DESKTOP_RECENT_FLAGS_LIMIT)).toEqual(
        recentFlags,
      );
      expect(addRecentFlag(recentFlags, '', DESKTOP_RECENT_FLAGS_LIMIT)).toEqual(
        recentFlags,
      );
      expect(
        addRecentFlag(recentFlags, undefined, DESKTOP_RECENT_FLAGS_LIMIT),
      ).toEqual(recentFlags);
    });
  });

  describe('seedRecentFlagsFromFlagValues', () => {
    it('returns an empty list for empty seed input', () => {
      expect(
        seedRecentFlagsFromFlagValues([], DESKTOP_RECENT_FLAGS_LIMIT),
      ).toEqual([]);
    });

    it('dedupes flags in most-recent-first order', () => {
      expect(
        seedRecentFlagsFromFlagValues(
          [
            ':red_circle:',
            null,
            ':blue_circle:',
            ':red_circle:',
            ':green_circle:',
          ],
          DESKTOP_RECENT_FLAGS_LIMIT,
        ),
      ).toEqual([':red_circle:', ':blue_circle:', ':green_circle:']);
    });

    it('stops once the supplied limit is reached', () => {
      expect(
        seedRecentFlagsFromFlagValues(
          [':red_circle:', ':blue_circle:', ':green_circle:'],
          2,
        ),
      ).toEqual([':red_circle:', ':blue_circle:']);
    });

    it('does not scan beyond the transaction seed limit', () => {
      const flags = [
        ...Array.from(
          { length: RECENT_FLAGS_SEED_TRANSACTION_LIMIT },
          () => null,
        ),
        ':red_circle:',
      ];

      expect(
        seedRecentFlagsFromFlagValues(flags, DESKTOP_RECENT_FLAGS_LIMIT),
      ).toEqual([]);
    });
  });

  describe('seedRecentFlagsFromTransactions', () => {
    it('seeds from transaction flag values', () => {
      expect(
        seedRecentFlagsFromTransactions(
          [
            { flag: ':red_circle:' },
            { flag: null },
            { flag: ':blue_circle:' },
            { flag: ':red_circle:' },
          ],
          DESKTOP_RECENT_FLAGS_LIMIT,
        ),
      ).toEqual([':red_circle:', ':blue_circle:']);
    });

    it('does not iterate transactions beyond the transaction seed limit', () => {
      let yieldedCount = 0;

      function* transactions() {
        for (let i = 0; i < RECENT_FLAGS_SEED_TRANSACTION_LIMIT + 1; i++) {
          yieldedCount += 1;
          yield {
            flag:
              i === RECENT_FLAGS_SEED_TRANSACTION_LIMIT
                ? ':red_circle:'
                : null,
          };
        }
      }

      expect(
        seedRecentFlagsFromTransactions(
          transactions(),
          DESKTOP_RECENT_FLAGS_LIMIT,
        ),
      ).toEqual([]);
      expect(yieldedCount).toBe(RECENT_FLAGS_SEED_TRANSACTION_LIMIT);
    });
  });
});
