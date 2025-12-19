import { clearSecureToken, getSecureToken, saveSecureToken } from '../storage/secure-store';
import type { AuthToken } from './browser-login';

export type StoredAuthToken = AuthToken;

export async function persistAuthToken(token: AuthToken): Promise<void> {
  await saveSecureToken(JSON.stringify(token));
}

export async function loadAuthToken(): Promise<StoredAuthToken | null> {
  const raw = await getSecureToken();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuthToken;
  } catch {
    return null;
  }
}

export async function clearAuthToken(): Promise<void> {
  await clearSecureToken();
}
