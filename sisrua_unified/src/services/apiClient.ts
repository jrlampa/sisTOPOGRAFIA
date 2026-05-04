
import { API_BASE_URL } from "../config/api";
import { getAuthSnapshot } from "../auth/authSession";

/**
 * Resolves the user identity from localStorage with appropriate fallbacks.
 * This ensures consistent identification across all API calls.
 */
export const resolveRequestIdentity = (): { userId: string; token: string | null } => {
  const snapshot = getAuthSnapshot();
  const fromStorage =
    snapshot.userId ||
    localStorage.getItem("sisrua_user_id") ||
    localStorage.getItem("sisrua_userId") ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("userId");

  const fallbackUserId =
    (import.meta.env.VITE_DEFAULT_USER_ID as string | undefined)?.trim() ||
    "system-admin";

  const userId = (fromStorage || fallbackUserId).trim();
  const token = snapshot.token || localStorage.getItem("sisrua_token");

  return { userId, token };
};

/**
 * Builds standardized headers for all API requests, 
 * including x-user-id for rate limiting and Authorization for security.
 */
export const buildApiHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
  const { userId, token } = resolveRequestIdentity();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-user-id": userId,
    ...extraHeaders
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Utility to handle common fetch logic with standardized headers.
 */
export const apiFetch = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const headers = buildApiHeaders((options.headers as Record<string, string>) || {});
  
  return fetch(url, {
    ...options,
    headers
  });
};
