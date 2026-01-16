import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AuthToken } from '../../src/services/auth/browser-login';
import * as browserLoginModule from '../../src/services/auth/browser-login';
import * as tokenManagerModule from '../../src/services/auth/token-manager';

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


describe('[module-mock] integration/cli-auth-login', () => {
  beforeEach(() => {
    runBrowserLoginMock.mockClear();
    persistAuthTokenMock.mockClear();
    mock.module('../../src/services/auth/browser-login', () => ({
      runBrowserLogin: runBrowserLoginMock,
    }));
    mock.module('../../src/services/auth/token-manager', () => ({
      persistAuthToken: persistAuthTokenMock,
    }));
  });

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
    // Workaround for https://github.com/oven-sh/bun/issues/7823 due to ESM caching.
    mock.module('../../src/services/auth/browser-login', () => ({ ...originalBrowserLogin }));
    mock.module('../../src/services/auth/token-manager', () => ({ ...originalTokenManager }));
  });

  it('[module-mock] runs browser login command and persists token', async () => {
    const { authLoginCommand } = await import('../../src/cli/auth/login');

    await authLoginCommand([]);

    expect(runBrowserLoginMock).toHaveBeenCalledTimes(1);
    expect(persistAuthTokenMock).toHaveBeenCalledWith(token);
  });
});
