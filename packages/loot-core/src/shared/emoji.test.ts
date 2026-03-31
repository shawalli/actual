import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@emoji-mart/data', () => ({
  default: {
    emojis: {
      grinning: {
        id: 'grinning',
        name: 'Grinning Face',
        skins: [{ native: '😀' }],
      },
      '100': {
        id: '100',
        name: 'Hundred Points',
        skins: [{ native: '💯' }],
      },
      large_blue_circle: {
        id: 'large_blue_circle',
        name: 'Blue Circle',
        skins: [{ native: '🔵' }],
      },
      thumbs_up: {
        id: 'thumbs_up',
        name: 'Thumbs Up',
        skins: [{ native: '👍' }],
      },
    },
  },
}));

let shortcodeToNative: (typeof import('./emoji'))['shortcodeToNative'];
let resetCache: (typeof import('./emoji'))['__resetEmojiCache'];

describe('emojiUtils', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = await import('./emoji');
    shortcodeToNative = module.shortcodeToNative;
    resetCache = module.__resetEmojiCache;
    resetCache();
  });

  describe('shortcodeToNative', () => {
    it('converts shortcode with colons to native emoji', () => {
      expect(shortcodeToNative(':grinning:')).toBe('😀');
      expect(shortcodeToNative(':100:')).toBe('💯');
      expect(shortcodeToNative(':large_blue_circle:')).toBe('🔵');
    });

    it('converts shortcode without colons to native emoji', () => {
      expect(shortcodeToNative('grinning')).toBe('😀');
      expect(shortcodeToNative('100')).toBe('💯');
      expect(shortcodeToNative('large_blue_circle')).toBe('🔵');
    });

    it('returns empty string for null input', () => {
      expect(shortcodeToNative(null)).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(shortcodeToNative('')).toBe('');
    });

    it('returns original string if shortcode not found', () => {
      expect(shortcodeToNative(':unknown_emoji:')).toBe(':unknown_emoji:');
      expect(shortcodeToNative('unknown_emoji')).toBe('unknown_emoji');
    });

    it('handles shortcode with only leading colon', () => {
      expect(shortcodeToNative(':grinning')).toBe('😀');
    });

    it('handles shortcode with only trailing colon', () => {
      expect(shortcodeToNative('grinning:')).toBe('😀');
    });

    it('converts standard shortcode to emoji', () => {
      expect(shortcodeToNative(':thumbs_up:')).toBe('👍');
    });

    it('handles multiple colons correctly', () => {
      expect(shortcodeToNative('::thumbs_up::')).toBe('👍');
      expect(shortcodeToNative(':::thumbs_up:::')).toBe('👍');
      expect(shortcodeToNative(':thumbs:up:')).toBe(':thumbs:up:');
    });
  });
});
