import { loadCliConfig } from '../../config/cli-config';
import { isTokenExpired, loadAuthToken } from './token-manager';

export type AuthStorageType = 'environment' | 'keychain' | 'file' | 'unknown';

export interface AuthStatus {
  authenticated: boolean;
  expired: boolean;
  expiresAt?: string;
  storage: AuthStorageType;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const config = loadCliConfig();
  const envToken = process.env.CURLYDOTS_TOKEN;

  if (envToken) {
    return {
      authenticated: true,
      expired: false,
      expiresAt: undefined,
      storage: 'environment',
    };
  }

  const token = await loadAuthToken();
  if (!token) {
    return {
      authenticated: false,
      expired: false,
      expiresAt: undefined,
      storage: config.tokenStorage ?? 'unknown',
    };
  }

  const expired = isTokenExpired(token);

  return {
    authenticated: !expired,
    expired,
    expiresAt: token.expiresAt,
    storage: config.tokenStorage ?? 'unknown',
  };
}
