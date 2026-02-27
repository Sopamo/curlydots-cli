import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { authLogoutCommand } from '../../../src/commands/auth/logout';
import * as tokenManagerModule from '../../../src/services/auth/token-manager';
import * as loggerModule from '../../../src/utils/logger';
import * as authConfigModule from '../../../src/config/auth-config';

const logs = {
  success: [] as string[],
  warn: [] as string[],
  error: [] as string[],
};

const clearAuthTokenMock = mock(async () => {});
const loadCliAuthConfigMock = mock(() => ({
  authMethod: 'browser' as const,
  tokenStorage: 'keychain' as const,
  token: undefined as string | undefined,
}));
const originalTokenManager = { ...tokenManagerModule };
const originalLogger = { ...loggerModule };
const originalAuthConfig = { ...authConfigModule };

describe('unit/cli/auth-logout', () => {
  beforeEach(() => {
    logs.success.length = 0;
    logs.warn.length = 0;
    logs.error.length = 0;
    clearAuthTokenMock.mockClear();
    loadCliAuthConfigMock.mockClear();
    process.exitCode = 0;
    delete process.env.CURLYDOTS_TOKEN;

    mock.module('../../../src/services/auth/token-manager', () => ({
      clearAuthToken: clearAuthTokenMock,
    }));

    mock.module('../../../src/config/auth-config', () => ({
      loadCliAuthConfig: loadCliAuthConfigMock,
    }));

    mock.module('../../../src/utils/logger', () => ({
      ...originalLogger,
      globalLogger: {
        info: () => {},
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
    mock.module('../../../src/utils/logger', () => ({ ...originalLogger }));
    mock.module('../../../src/config/auth-config', () => ({ ...originalAuthConfig }));
  });

  it('clears local tokens without warning when no API token is set', async () => {
    await authLogoutCommand([]);

    expect(clearAuthTokenMock).toHaveBeenCalledTimes(1);
    expect(logs.success.some((message) => message.includes('Logged out locally'))).toBe(true);
    expect(logs.warn.some((message) => message.includes('API tokens'))).toBe(false);
  });

  it('warns about API tokens when CURLYDOTS_TOKEN is set', async () => {
    process.env.CURLYDOTS_TOKEN = 'api-token';

    await authLogoutCommand([]);

    expect(logs.warn.some((message) => message.includes('CURLYDOTS_TOKEN'))).toBe(true);
  });

  it('warns about API tokens when auth.json token is set', async () => {
    loadCliAuthConfigMock.mockReturnValueOnce({
      authMethod: 'api_key',
      tokenStorage: 'file',
      token: 'api-token',
    });

    await authLogoutCommand([]);

    expect(logs.warn.some((message) => message.includes('auth.json'))).toBe(true);
  });

  it('reports errors when logout fails', async () => {
    clearAuthTokenMock.mockRejectedValueOnce(new Error('Storage error'));

    await authLogoutCommand([]);

    expect(logs.error.some((message) => message.includes('Logout failed'))).toBe(true);
    expect(process.exitCode).toBe(1);
  });
});
