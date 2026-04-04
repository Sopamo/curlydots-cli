import { loadCliAuthConfig } from '../../config/auth-config';
import { loadCliConfig } from '../../config/cli-config';
import { HttpClient, HttpClientError } from '../http/client';
import { getValidToken, isTokenExpired, loadAuthToken } from './token-manager';

export type AuthStorageType = 'environment' | 'keychain' | 'file' | 'unknown';
export type AuthSource = 'environment_token' | 'api_key' | 'browser_session';

export interface AuthStatus {
  authenticated: boolean;
  expired: boolean;
  expiresAt?: string;
  storage: AuthStorageType;
  source: AuthSource | null;
}

interface ApiAuthStatus {
  authenticated: boolean;
  expires_at?: string | null;
}

interface ExplicitAccessToken {
  token: string;
  storage: 'environment' | 'file';
  source: 'environment_token' | 'api_key';
}

interface ResolvedAuthSource {
  token?: string;
  expiresAt?: string;
  expired: boolean;
  storage: AuthStorageType;
  source: AuthSource | null;
}

export function getExplicitAccessToken(baseDir?: string): ExplicitAccessToken | null {
  const envToken = process.env.CURLYDOTS_TOKEN;
  if (envToken) {
    return {
      token: envToken,
      storage: 'environment',
      source: 'environment_token',
    };
  }

  const configuredToken = loadCliAuthConfig(baseDir).token;
  if (configuredToken) {
    return {
      token: configuredToken,
      storage: 'file',
      source: 'api_key',
    };
  }

  return null;
}

export async function resolveAuthSource(baseDir?: string): Promise<ResolvedAuthSource> {
  const explicitToken = getExplicitAccessToken(baseDir);
  if (explicitToken) {
    return {
      ...explicitToken,
      expired: false,
    };
  }

  const authConfig = loadCliAuthConfig(baseDir);
  const storedToken = await loadAuthToken();
  if (!storedToken) {
    return {
      expired: false,
      storage: authConfig.tokenStorage ?? 'unknown',
      source: null,
    };
  }

  return {
    token: storedToken.accessToken,
    expiresAt: storedToken.expiresAt,
    expired: isTokenExpired(storedToken),
    storage: authConfig.tokenStorage ?? 'unknown',
    source: 'browser_session',
  };
}

export async function getCliAccessToken(baseDir?: string): Promise<string> {
  const resolved = await resolveAuthSource(baseDir);

  if (resolved.source === 'environment_token' || resolved.source === 'api_key') {
    return resolved.token!;
  }

  if (resolved.source === 'browser_session' && resolved.token && !resolved.expired) {
    return resolved.token;
  }

  return getValidToken();
}

export function formatAuthSourceLabel(source: AuthSource | null, storage: AuthStorageType): string {
  if (source === 'environment_token') {
    return 'environment token (CURLYDOTS_TOKEN)';
  }

  if (source === 'api_key') {
    return 'API token from auth.json';
  }

  if (source === 'browser_session' && storage === 'keychain') {
    return 'browser session (keychain)';
  }

  if (source === 'browser_session' && storage === 'file') {
    return 'browser session (file fallback)';
  }

  return storage;
}

export async function getAuthStatus(baseDir?: string): Promise<AuthStatus> {
  const config = loadCliConfig(baseDir);
  const resolved = await resolveAuthSource(baseDir);

  if (resolved.source === null) {
    return {
      authenticated: false,
      expired: false,
      expiresAt: undefined,
      storage: resolved.storage,
      source: resolved.source,
    };
  }

  if (resolved.source === 'browser_session' && resolved.expired) {
    return {
      authenticated: false,
      expired: true,
      expiresAt: resolved.expiresAt,
      storage: resolved.storage,
      source: resolved.source,
    };
  }

  const apiAuth = await validateTokenWithApi(resolved.token!, config);
  if (apiAuth === false || apiAuth === null) {
    return {
      authenticated: false,
      expired: false,
      expiresAt: resolved.expiresAt,
      storage: resolved.storage,
      source: resolved.source,
    };
  }

  return {
    authenticated: true,
    expired: false,
    expiresAt: apiAuth.expires_at ?? resolved.expiresAt,
    storage: resolved.storage,
    source: resolved.source,
  };
}

async function validateTokenWithApi(
  token: string,
  config: ReturnType<typeof loadCliConfig>,
): Promise<ApiAuthStatus | false | null> {
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
