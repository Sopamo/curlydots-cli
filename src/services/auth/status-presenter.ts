import { loadCliConfig } from '../../config/cli-config';
import { loadCliAuthConfig } from '../../config/auth-config';
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
  const authConfig = loadCliAuthConfig();
  const envToken = process.env.CURLYDOTS_TOKEN;
  const configuredToken = authConfig.token;
  const explicitToken = envToken ?? configuredToken;
  const explicitTokenStorage: AuthStorageType = envToken ? 'environment' : 'file';

  if (explicitToken) {
    const apiAuth = await validateTokenWithApi(explicitToken, config);
    if (apiAuth === false || apiAuth === null) {
      return {
        authenticated: false,
        expired: false,
        expiresAt: undefined,
        storage: explicitTokenStorage,
      };
    }

    return {
      authenticated: true,
      expired: false,
      expiresAt: apiAuth?.expires_at ?? undefined,
      storage: explicitTokenStorage,
    };
  }

  const token = await loadAuthToken();
  if (!token) {
    return {
      authenticated: false,
      expired: false,
      expiresAt: undefined,
      storage: authConfig.tokenStorage ?? 'unknown',
    };
  }

  const expired = isTokenExpired(token);
  if (expired) {
    return {
      authenticated: false,
      expired: true,
      expiresAt: token.expiresAt,
      storage: authConfig.tokenStorage ?? 'unknown',
    };
  }

  const apiAuth = await validateTokenWithApi(token.accessToken, config);
  if (apiAuth === false || apiAuth === null) {
    return {
      authenticated: false,
      expired: false,
      expiresAt: token.expiresAt,
      storage: authConfig.tokenStorage ?? 'unknown',
    };
  }

  return {
    authenticated: true,
    expired: false,
    expiresAt: token.expiresAt,
    storage: authConfig.tokenStorage ?? 'unknown',
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
