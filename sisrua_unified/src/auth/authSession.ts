export interface AuthSnapshot {
  userId: string | null;
  token: string | null;
  email: string | null;
}

let authSnapshot: AuthSnapshot = {
  userId: null,
  token: null,
  email: null,
};

export function getAuthSnapshot(): AuthSnapshot {
  return authSnapshot;
}

export function setAuthSnapshot(nextSnapshot: AuthSnapshot): void {
  authSnapshot = nextSnapshot;
}

export function clearLegacyAuthStorage(): void {
  localStorage.removeItem("sisrua_token");
  localStorage.removeItem("sisrua_user_id");
  localStorage.removeItem("sisrua_userId");
  localStorage.removeItem("user_id");
  localStorage.removeItem("userId");
}