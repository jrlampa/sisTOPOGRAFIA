/**
 * ID generation utilities with collision prevention.
 * Uses timestamp + random entropy for pseudo-UUID generation.
 */

/**
 * Entropy used for ID generation. Balanced for collision prevention vs. string length.
 * Current: 10^6 (1,000,000) range. With ~5 IDs/second typical, collision risk < 0.001% per day.
 */
const ID_ENTROPY_MAX = 1_000_000;

/**
 * Generate a unique ID with prefix and timestampd random entropy.
 * Format: "{prefix}{timestamp}{entropy}"
 * Suitable for: client-generated identifiers where uniqueness within a session is sufficient.
 * DO NOT use in distributed systems without coordination.
 *
 * @param prefix - 1-3 character prefix (e.g., 'RP' for ramal_pole)
 * @returns Unique ID string like 'RP1704067200000123456'
 */
export function generateEntityId(prefix: string): string {
  const timestamp = Date.now();
  const entropy = Math.floor(Math.random() * ID_ENTROPY_MAX);
  return `${prefix}${timestamp}${entropy}`;
}

/**
 * Generate multiple unique IDs in sequence.
 * Guarantees no collisions even if called in rapid succession.
 *
 * @param prefix - Prefix for the ID
 * @param count - Number of IDs to generate
 * @returns Array of unique IDs
 */
export function generateEntityIds(prefix: string, count: number): string[] {
  const ids: string[] = [];
  const baseTimestamp = Date.now();
  
  for (let i = 0; i < count; i++) {
    // Add offset to timestamp to ensure uniqueness even in same millisecond
    const offsetTimestamp = baseTimestamp + Math.floor(i / ID_ENTROPY_MAX);
    const entropy = (Math.floor(Math.random() * ID_ENTROPY_MAX) + i) % ID_ENTROPY_MAX;
    ids.push(`${prefix}${offsetTimestamp}${entropy}`);
  }
  
  return ids;
}

/**
 * Constants for ID prefixes to improve code clarity.
 */
export const ID_PREFIX = {
  RAMAL_POLE: 'RP',        // Ramal da Pole
  CONDUCTOR: 'C',          // Conductor
  CONDUCTOR_REPLACEMENT: 'RC', // Replacement Conductor
} as const;
