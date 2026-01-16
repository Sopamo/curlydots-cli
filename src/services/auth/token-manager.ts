import { clearSecureToken, getSecureToken, saveSecureToken } from '../storage/secure-store';
import type { AuthToken } from './browser-login';
import { runBrowserLogin } from './browser-login';
import { globalLogger } from '../../utils/logger';

export type StoredAuthToken = AuthToken;

export async function persistAuthToken(token: AuthToken): Promise<void> {
  await saveSecureToken(JSON.stringify(token));
}

export async function loadAuthToken(): Promise<StoredAuthToken | null> {
  const raw = await getSecureToken();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuthToken;
    if (parsed?.accessToken && parsed.expiresAt) {
      return parsed;
    }
  } catch {
    // fall through to treat raw token as access token
  }

  return {
    accessToken: raw,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function clearAuthToken(): Promise<void> {
  await clearSecureToken();
}

export function isTokenExpired(token: AuthToken): boolean {
  const expiresAt = new Date(token.expiresAt).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000;
  return now >= (expiresAt - bufferMs);
}

export async function getValidToken(): Promise<string> {
  let token = await loadAuthToken();
  
  if (!token) {
    globalLogger.warn('No authentication token found. Please log in.');
    globalLogger.info('Starting authentication flow...');
    token = await runBrowserLogin();
    await persistAuthToken(token);
    globalLogger.success('Authentication complete.');
  } else if (isTokenExpired(token)) {
    globalLogger.warn('Authentication token has expired. Renewing...');
    token = await runBrowserLogin();
    await persistAuthToken(token);
    globalLogger.success('Token renewed.');
  }
  
  return token.accessToken;
}
