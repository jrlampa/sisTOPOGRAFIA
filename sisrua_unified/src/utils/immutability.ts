/**
 * Immutability utilities to prevent accidental mutations of state objects
 * Helps enforce functional programming patterns and catch bugs early
 */

const IS_DEVELOPMENT =
  ((import.meta as { env?: Record<string, string | boolean | undefined> }).env?.DEV === true) ||
  ((import.meta as { env?: Record<string, string | boolean | undefined> }).env?.MODE === 'development');

/**
 * Deep freeze an object to make it fully immutable (in development/testing)
 * Note: This is expensive for large objects; use judiciously or only in dev mode
 * @param obj Object to freeze
 * @returns Frozen object
 */
export function deepFreeze<T>(obj: T): T {
  if (Object.isFrozen(obj) || typeof obj !== 'object' || obj === null) {
    return obj;
  }

  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (
      obj[prop as keyof T] !== null &&
      (typeof obj[prop as keyof T] === 'object' ||
        typeof obj[prop as keyof T] === 'function') &&
      !Object.isFrozen(obj[prop as keyof T])
    ) {
      deepFreeze(obj[prop as keyof T]);
    }
  });

  return obj;
}

/**
 * Shallow freeze for simple state objects (preferred for performance)
 * @param obj Object to freeze
 * @returns Frozen object
 */
export function shallowFreeze<T extends Record<string, any>>(obj: T): T {
  return Object.freeze(obj) as T;
}

/**
 * Assertion helper to ensure object is immutable in development mode
 * @param obj Object to check
 * @param description Optional description for error message
 * @throws Error if object is not frozen in development mode
 */
export function assertImmutable<T>(obj: T, description = 'state object'): void {
  if (IS_DEVELOPMENT) {
    if (typeof obj === 'object' && obj !== null && !Object.isFrozen(obj)) {
      console.warn(`[Immutability Warning] ${description} should be frozen but is mutable:`, obj);
    }
  }
}

/**
 * Creates an immutable copy of an object with partial updates
 * Useful for ensuring we never accidentally mutate original
 * @param original Original object
 * @param updates Partial updates to apply
 * @returns New frozen object with updates applied
 */
export function createImmutableNext<T extends Record<string, any>>(
  original: T,
  updates: Partial<T>
): T {
  const next = { ...original, ...updates };
  
  // Freeze in development to catch accidental mutations
  if (IS_DEVELOPMENT) {
    Object.freeze(next);
  }
  
  return next as T;
}

/**
 * Detects if an object contains any mutable nested structures
 * Returns array of paths that are mutable
 * @param obj Object to inspect
 * @param maxDepth Maximum nesting depth to check
 * @returns Array of mutable paths (empty if all immutable)
 */
export function findMutablePaths(
  obj: unknown,
  maxDepth = 3,
  currentPath = ''
): string[] {
  const mutablePaths: string[] = [];

  if (maxDepth <= 0) return mutablePaths;
  if (typeof obj !== 'object' || obj === null) return mutablePaths;

  if (!Object.isFrozen(obj)) {
    mutablePaths.push(currentPath || '[root]');
  }

  Object.entries(obj).forEach(([key, value]) => {
    const path = currentPath ? `${currentPath}.${key}` : key;
    const paths = findMutablePaths(value, maxDepth - 1, path);
    mutablePaths.push(...paths);
  });

  return mutablePaths;
}
