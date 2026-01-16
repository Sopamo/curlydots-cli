import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AuthToken } from '../../src/services/auth/browser-login';

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

mock.module('../../src/services/auth/browser-login', () => ({
  runBrowserLogin: runBrowserLoginMock,
}));

mock.module('../../src/services/auth/token-manager', () => ({
  persistAuthToken: persistAuthTokenMock,
  clearAuthToken: async () => {},
  loadAuthToken: async () => null,
}));

mock.module('../../src/utils/logger', () => ({
  globalLogger: {
    info: (message: string) => logs.info.push(message),
    success: (message: string) => logs.success.push(message),
    warn: (message: string) => logs.warn.push(message),
    error: (message: string) => logs.error.push(message),
    spinner: () => {},
  },
}));

describe('integration/cli-auth-login', () => {
  beforeEach(() => {
    runBrowserLoginMock.mockClear();
    persistAuthTokenMock.mockClear();
    logs.info.length = 0;
    logs.success.length = 0;
    logs.warn.length = 0;
    logs.error.length = 0;
  });

  it('runs browser login command and persists token', async () => {
    const { runCli } = await import('../../src/cli');

    await runCli(['auth', 'login']);

    expect(runBrowserLoginMock).toHaveBeenCalledTimes(1);
    expect(persistAuthTokenMock).toHaveBeenCalledWith(token);
    expect(logs.success.some((message) => message.includes('Logged in'))).toBe(true);
  });
});
