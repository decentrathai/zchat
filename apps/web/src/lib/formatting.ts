/**
 * Shared formatting utilities for ZCHAT web app
 */

/**
 * Truncates long addresses or transaction IDs for display
 * @param address - The address or txid to truncate
 * @param prefixLen - Number of characters to show at start (default 5)
 * @param suffixLen - Number of characters to show at end (default 5)
 * @returns Truncated string with ellipsis, or original if short enough
 */
export const truncateAddress = (address: string, prefixLen = 5, suffixLen = 5): string => {
  if (!address) return '';
  if (address.length <= prefixLen + suffixLen + 3) return address;
  // Handle edge case: slice(-0) returns entire string, not empty (MEDIUM #B5)
  const suffix = suffixLen > 0 ? address.slice(-suffixLen) : '';
  return `${address.slice(0, prefixLen)}...${suffix}`;
};
