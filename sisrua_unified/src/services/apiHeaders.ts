const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const LOCAL_USER_ID_STORAGE_KEY = 'sisrua.localUserId';
const DEFAULT_LOCAL_USER_ID = 'system-admin';

const readStoredLocalUserId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_USER_ID_STORAGE_KEY)?.trim();
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
};

export const getApiUserId = (): string | null => {
  const storedUserId = readStoredLocalUserId();
  if (storedUserId) {
    return storedUserId;
  }

  const configuredUserId = import.meta.env.VITE_LOCAL_USER_ID?.trim();
  if (configuredUserId) {
    return configuredUserId;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const hostname = window.location.hostname.toLowerCase();
  if (LOCALHOST_HOSTNAMES.has(hostname)) {
    return DEFAULT_LOCAL_USER_ID;
  }

  return null;
};

export const buildApiHeaders = (
  headers: Record<string, string> = {},
): Record<string, string> => {
  const userId = getApiUserId();
  if (!userId) {
    return headers;
  }

  return {
    ...headers,
    'x-user-id': userId,
  };
};