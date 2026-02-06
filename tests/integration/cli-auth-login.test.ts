import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AuthToken } from '../../src/services/auth/browser-login';
import * as browserLoginModule from '../../src/services/auth/browser-login';
import * as tokenManagerModule from '../../src/services/auth/token-manager';

const logs = {
  info: [] as string[],
  success: [] as string[],
  warn: [] as string[],
  error: [] as string[],
};

const token: AuthToken = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  scope: ['translations:write'],
};

const runBrowserLoginMock = mock(async () => token);
const persistAuthTokenMock = mock(async () => {});
const originalBrowserLogin = { ...browserLoginModule };
const originalTokenManager = { ...tokenManagerModule };

describe('integration/cli-auth-login', () => {
  beforeEach(() => {
    runBrowserLoginMock.mockClear();
    persistAuthTokenMock.mockClear();
    logs.info.length = 0;
    logs.success.length = 0;
    logs.warn.length = 0;
    logs.error.length = 0;

    mock.module('../../src/services/auth/browser-login', () => ({
      runBrowserLogin: runBrowserLoginMock,
    }));

    mock.module('../../src/services/auth/token-manager', () => ({
      persistAuthToken: persistAuthTokenMock,
      clearAuthToken: async () => {},
      loadAuthToken: async () => null,
      isTokenExpired: () => false,
    }));

    mock.module('../../src/utils/logger', () => ({
      Logger: class Logger {
        info() {}
        success() {}
        warn() {}
        error() {}
        spinner() {}
      },
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
    mock.clearAllMocks();
    mock.restore();
    // Workaround for https://github.com/oven-sh/bun/issues/7823 due to ESM caching.
    mock.module('../../src/services/auth/browser-login', () => ({ ...originalBrowserLogin }));
    mock.module('../../src/services/auth/token-manager', () => ({ ...originalTokenManager }));
  });

  it('runs browser login command and persists token', async () => {
    const { runCli } = await import('../../src/cli');

    await runCli(['auth', 'login']);

    expect(runBrowserLoginMock).toHaveBeenCalledTimes(1);
    expect(persistAuthTokenMock).toHaveBeenCalledWith(token);
    expect(logs.success.some((message) => message.includes('Logged in'))).toBe(true);
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
});
