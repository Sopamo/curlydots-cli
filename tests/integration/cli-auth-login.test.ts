import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AuthToken } from '../../src/services/auth/browser-login';
import * as browserLoginModule from '../../src/services/auth/browser-login';
import * as tokenManagerModule from '../../src/services/auth/token-manager';
import * as authServiceModule from '../../src/services/auth/service';
import * as loggerModule from '../../src/utils/logger';

const token: AuthToken = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  scope: ['translations:write'],
};

const runBrowserLoginMock = mock(async () => token);
const persistAuthTokenMock = mock(async () => {});
const getExplicitAccessTokenMock = mock<
  () => { source: 'environment_token' | 'api_key'; storage: 'environment' | 'file'; token: string } | null
>(() => null);
const getSecureTokenMock = mock(async () => null);
const saveSecureTokenMock = mock(async () => {});
const originalBrowserLogin = { ...browserLoginModule };
const originalTokenManager = { ...tokenManagerModule };
const originalAuthService = { ...authServiceModule };
const originalLogger = { ...loggerModule };

const logs = {
  warn: [] as string[],
  success: [] as string[],
};


describe('[module-mock] integration/cli-auth-login', () => {
  beforeEach(() => {
    runBrowserLoginMock.mockClear();
    persistAuthTokenMock.mockClear();
    getExplicitAccessTokenMock.mockClear();
    logs.warn.length = 0;
    logs.success.length = 0;
    process.exitCode = undefined;
    delete process.env.CURLYDOTS_TOKEN;
    mock.module('../../src/services/auth/browser-login', () => ({
      runBrowserLogin: runBrowserLoginMock,
    }));
    mock.module('../../src/services/auth/token-manager', () => ({
      persistAuthToken: persistAuthTokenMock,
    }));
    mock.module('../../src/services/storage/secure-store', () => ({
      getSecureToken: getSecureTokenMock,
      saveSecureToken: saveSecureTokenMock,
      clearSecureToken: async () => {},
    }));
    mock.module('../../src/services/auth/service', () => ({
      ...originalAuthService,
      getExplicitAccessToken: getExplicitAccessTokenMock,
    }));
    mock.module('../../src/utils/logger', () => ({
      ...originalLogger,
      globalLogger: {
        info: () => {},
        warn: (message: string) => logs.warn.push(message),
        success: (message: string) => logs.success.push(message),
        error: () => {},
        spinner: () => {},
      },
    }));
  });

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
    // Workaround for https://github.com/oven-sh/bun/issues/7823 due to ESM caching.
    mock.module('../../src/services/auth/browser-login', () => ({ ...originalBrowserLogin }));
    mock.module('../../src/services/auth/token-manager', () => ({ ...originalTokenManager }));
    mock.module('../../src/services/auth/service', () => ({ ...originalAuthService }));
    mock.module('../../src/utils/logger', () => ({ ...originalLogger }));
  });

  it('[module-mock] runs browser login command and persists token', async () => {
    const { authLoginCommand } = await import('../../src/commands/auth/login');

    await authLoginCommand([]);

    expect(runBrowserLoginMock).toHaveBeenCalledTimes(1);
    expect(persistAuthTokenMock).toHaveBeenCalledWith(token);
  });

  it('skips login when a valid token already exists', async () => {
    mock.module('../../src/services/auth/token-manager', () => ({
      persistAuthToken: persistAuthTokenMock,
      clearAuthToken: async () => {},
      loadAuthToken: async () => token,
      isTokenExpired: () => false,
    }));

    const { runCli } = await import('../../src/cli');

    await runCli(['auth', 'login']);

    expect(runBrowserLoginMock).toHaveBeenCalledTimes(0);
    expect(persistAuthTokenMock).toHaveBeenCalledTimes(0);
    expect(logs.success.some((message) => message.includes('Already authenticated'))).toBe(true);
  });

  it('skips browser login when CURLYDOTS_TOKEN is set', async () => {
    process.env.CURLYDOTS_TOKEN = 'env-token';
    getExplicitAccessTokenMock.mockReturnValueOnce({
      source: 'environment_token',
      storage: 'environment',
      token: 'env-token',
    });

    const { runCli } = await import('../../src/cli');

    await runCli(['auth', 'login']);

    expect(runBrowserLoginMock).toHaveBeenCalledTimes(0);
    expect(persistAuthTokenMock).toHaveBeenCalledTimes(0);
    expect(logs.warn.some((message) => message.includes('CURLYDOTS_TOKEN is set'))).toBe(true);
  });

  it('skips browser login when auth.json token is configured', async () => {
    getExplicitAccessTokenMock.mockReturnValueOnce({
      source: 'api_key',
      storage: 'file',
      token: 'file-token',
    });

    const { runCli } = await import('../../src/cli');

    await runCli(['auth', 'login']);

    expect(runBrowserLoginMock).toHaveBeenCalledTimes(0);
    expect(persistAuthTokenMock).toHaveBeenCalledTimes(0);
    expect(logs.warn.some((message) => message.includes('auth.json'))).toBe(true);
  });
});
