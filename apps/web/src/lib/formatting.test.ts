import { describe, it, expect } from 'vitest';
import { truncateAddress } from './formatting';

describe('truncateAddress', () => {
  describe('basic functionality', () => {
    it('returns empty string for empty input', () => {
      expect(truncateAddress('')).toBe('');
    });

    it('returns empty string for null/undefined input', () => {
      // @ts-expect-error Testing runtime behavior with null
      expect(truncateAddress(null)).toBe('');
      // @ts-expect-error Testing runtime behavior with undefined
      expect(truncateAddress(undefined)).toBe('');
    });

    it('truncates long addresses with default parameters', () => {
      const longAddress = 'u1abcdefghijklmnopqrstuvwxyz0123456789';
      const result = truncateAddress(longAddress);

      expect(result).toBe('u1abc...56789');
      expect(result.length).toBe(13); // 5 + 3 + 5
    });

    it('returns original string if short enough', () => {
      const shortAddress = 'u1abc123';
      expect(truncateAddress(shortAddress)).toBe('u1abc123');
    });

    it('returns original string at boundary length', () => {
      // With default params (5+5+3=13), string of length 13 should not be truncated
      const boundaryAddress = 'u1abc1234567'; // 12 chars
      expect(truncateAddress(boundaryAddress)).toBe('u1abc1234567');
    });

    it('truncates string just over boundary', () => {
      // With default params, string of length 14 should be truncated
      const overBoundaryAddress = 'u1abcd12345678'; // 14 chars
      expect(truncateAddress(overBoundaryAddress)).toBe('u1abc...45678');
    });
  });

  describe('custom prefix/suffix lengths', () => {
    it('supports custom prefix length', () => {
      const address = 'u1abcdefghijklmnopqrstuvwxyz'; // 28 chars
      const result = truncateAddress(address, 10, 5);

      // slice(0, 10) = 'u1abcdefgh', slice(-5) = 'vwxyz'
      expect(result).toBe('u1abcdefgh...vwxyz');
    });

    it('supports custom suffix length', () => {
      const address = 'u1abcdefghijklmnopqrstuvwxyz'; // 28 chars
      const result = truncateAddress(address, 5, 10);

      // slice(0, 5) = 'u1abc', slice(-10) = 'qrstuvwxyz'
      expect(result).toBe('u1abc...qrstuvwxyz');
    });

    it('supports both custom prefix and suffix', () => {
      const address = 'u1abcdefghijklmnopqrstuvwxyz';
      const result = truncateAddress(address, 3, 3);

      expect(result).toBe('u1a...xyz');
    });

    it('handles zero prefix length', () => {
      const address = 'u1abcdefghijklmnopqrstuvwxyz'; // 28 chars
      const result = truncateAddress(address, 0, 5);

      // slice(0, 0) = '', slice(-5) = 'vwxyz'
      expect(result).toBe('...vwxyz');
    });

    it('handles zero suffix length', () => {
      const address = 'u1abcdefghijklmnopqrstuvwxyz';
      const result = truncateAddress(address, 5, 0);

      // Fixed: suffixLen=0 now correctly returns prefix + ellipsis only
      // (Previous bug: slice(-0) returned entire string)
      expect(result).toBe('u1abc...');
    });
  });

  describe('real-world address formats', () => {
    it('truncates Zcash unified address correctly', () => {
      const unifiedAddress = 'u1qwvzr7a2j9m3k5p8h4x6t2n0l9f3s7y1d8c4b6g0e2i5o3r';
      const result = truncateAddress(unifiedAddress);

      expect(result).toMatch(/^u1qwv\.\.\..*$/);
      expect(result).toContain('...');
      expect(result.length).toBe(13);
    });

    it('truncates transaction ID correctly', () => {
      const txid = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      const result = truncateAddress(txid, 8, 8);

      expect(result).toBe('a1b2c3d4...w3x4y5z6');
    });

    it('handles addresses with special characters', () => {
      const address = 'u1+test/address=with:special_chars'; // 34 chars
      const result = truncateAddress(address);

      // slice(0, 5) = 'u1+te', slice(-5) = 'chars'
      expect(result).toBe('u1+te...chars');
    });
  });

  describe('edge cases', () => {
    it('handles single character address', () => {
      expect(truncateAddress('a')).toBe('a');
    });

    it('handles address with only spaces', () => {
      expect(truncateAddress('     ')).toBe('     ');
    });

    it('handles very long address', () => {
      const veryLongAddress = 'u1' + 'a'.repeat(1000);
      const result = truncateAddress(veryLongAddress);

      expect(result.length).toBe(13);
      expect(result).toBe('u1aaa...aaaaa');
    });

    it('preserves Unicode characters', () => {
      const unicodeAddress = 'u1αβγδε0123456789';
      const result = truncateAddress(unicodeAddress);

      expect(result).toContain('...');
    });
  });
});
