import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { authLogoutCommand } from '../../../src/commands/auth/logout';
import * as tokenManagerModule from '../../../src/services/auth/token-manager';
import * as authServiceModule from '../../../src/services/auth/service';
import * as loggerModule from '../../../src/utils/logger';

const logs = {
  info: [] as string[],
  success: [] as string[],
  warn: [] as string[],
  error: [] as string[],
};

const clearAuthTokenMock = mock(async () => {});
const loadAuthTokenMock = mock(async () => null);
const getExplicitAccessTokenMock = mock<
  () => { source: 'environment_token' | 'api_key'; storage: 'environment' | 'file'; token: string } | null
>(() => null);
const originalTokenManager = { ...tokenManagerModule };
const originalAuthService = { ...authServiceModule };
const originalLogger = { ...loggerModule };

describe('unit/cli/auth-logout', () => {
  beforeEach(() => {
    logs.info.length = 0;
    logs.success.length = 0;
    logs.warn.length = 0;
    logs.error.length = 0;
    clearAuthTokenMock.mockClear();
    loadAuthTokenMock.mockClear();
    loadAuthTokenMock.mockResolvedValue(null);
    getExplicitAccessTokenMock.mockClear();
    getExplicitAccessTokenMock.mockReturnValue(null);
    process.exitCode = 0;
    delete process.env.CURLYDOTS_TOKEN;

    mock.module('../../../src/services/auth/token-manager', () => ({
      clearAuthToken: clearAuthTokenMock,
      loadAuthToken: loadAuthTokenMock,
    }));

    mock.module('../../../src/services/auth/service', () => ({
      ...originalAuthService,
      getExplicitAccessToken: getExplicitAccessTokenMock,
    }));

    mock.module('../../../src/utils/logger', () => ({
      ...originalLogger,
      globalLogger: {
        info: (message: string) => logs.info.push(message),
        success: (message: string) => logs.success.push(message),
        warn: (message: string) => logs.warn.push(message),
        error: (message: string) => logs.error.push(message),
        spinner: () => {},
      },
    }));
  });

  afterEach(() => {
    process.exitCode = 0;
    mock.clearAllMocks();
    mock.restore();
    // Workaround for https://github.com/oven-sh/bun/issues/7823 due to ESM caching.
    mock.module('../../../src/services/auth/token-manager', () => ({ ...originalTokenManager }));
    mock.module('../../../src/services/auth/service', () => ({ ...originalAuthService }));
    mock.module('../../../src/utils/logger', () => ({ ...originalLogger }));
  });

  it('reports when no stored browser session exists', async () => {
    await authLogoutCommand([]);

    expect(clearAuthTokenMock).toHaveBeenCalledTimes(1);
    expect(logs.info.some((message) => message.includes('No stored browser session found'))).toBe(true);
    expect(logs.success).toHaveLength(0);
    expect(logs.warn.some((message) => message.includes('API tokens'))).toBe(false);
  });

  it('warns about API tokens when CURLYDOTS_TOKEN is set', async () => {
    getExplicitAccessTokenMock.mockReturnValueOnce({
      source: 'environment_token',
      storage: 'environment',
      token: 'api-token',
    });

    await authLogoutCommand([]);

    expect(logs.warn.some((message) => message.includes('CURLYDOTS_TOKEN'))).toBe(true);
  });

  it('warns about API tokens when auth.json token is set', async () => {
    getExplicitAccessTokenMock.mockReturnValueOnce({
      source: 'api_key',
      storage: 'file',
      token: 'api-token',
    });

    await authLogoutCommand([]);

    expect(logs.warn.some((message) => message.includes('auth.json'))).toBe(true);
  });

  it('confirms browser session logout explicitly', async () => {
    loadAuthTokenMock.mockResolvedValueOnce({
      accessToken: 'browser-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await authLogoutCommand([]);

    expect(
      logs.success.some((message) => message.includes('Logged out from stored browser session')),
    ).toBe(true);
  });

  it('reports errors when logout fails', async () => {
    clearAuthTokenMock.mockRejectedValueOnce(new Error('Storage error'));

    await authLogoutCommand([]);

    expect(logs.error.some((message) => message.includes('Logout failed'))).toBe(true);
    expect(process.exitCode).toBe(1);
  });
});
