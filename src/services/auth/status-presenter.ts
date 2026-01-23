import { loadCliConfig } from '../../config/cli-config';
import { HttpClient, HttpClientError } from '../http/client';
import { isTokenExpired, loadAuthToken } from './token-manager';

export type AuthStorageType = 'environment' | 'keychain' | 'file' | 'unknown';

export interface AuthStatus {
  authenticated: boolean;
  expired: boolean;
  expiresAt?: string;
  storage: AuthStorageType;
}

interface ApiAuthStatus {
  authenticated: boolean;
  expires_at?: string | null;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const config = loadCliConfig();
  const envToken = process.env.CURLYDOTS_TOKEN;

  if (envToken) {
    const apiAuth = await validateTokenWithApi(envToken, config);
    if (apiAuth === false) {
      return {
        authenticated: false,
        expired: false,
        expiresAt: undefined,
        storage: 'environment',
      };
    }

    return {
      authenticated: true,
      expired: false,
      expiresAt: apiAuth?.expires_at ?? undefined,
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
  if (expired) {
    return {
      authenticated: false,
      expired: true,
      expiresAt: token.expiresAt,
      storage: config.tokenStorage ?? 'unknown',
    };
  }

  const apiAuth = await validateTokenWithApi(token.accessToken, config);
  if (apiAuth === false) {
    return {
      authenticated: false,
      expired: false,
      expiresAt: token.expiresAt,
      storage: config.tokenStorage ?? 'unknown',
    };
  }

  return {
    authenticated: true,
    expired: false,
    expiresAt: token.expiresAt,
    storage: config.tokenStorage ?? 'unknown',
  };
}

async function validateTokenWithApi(token: string, config: ReturnType<typeof loadCliConfig>): Promise<ApiAuthStatus | false | null> {
  const client = HttpClient.fromConfig(config);

  try {
    return await client.get<ApiAuthStatus>('cli/auth/status', {
      token,
    });
  } catch (error) {
    if (error instanceof HttpClientError && error.meta.category === 'authentication') {
      return false;
    }

    return null;
  }
}
