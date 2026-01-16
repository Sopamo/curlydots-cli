import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import * as tokenManagerModule from '../../src/services/auth/token-manager';
import * as loggerModule from '../../src/utils/logger';

const clearAuthTokenMock = mock(async () => {});
const originalTokenManager = { ...tokenManagerModule };
const originalLogger = { ...loggerModule };

const logs = {
  success: [] as string[],
  warn: [] as string[],
  error: [] as string[],
};

describe('integration/cli-auth-logout', () => {
  beforeEach(() => {
    clearAuthTokenMock.mockClear();
    logs.success.length = 0;
    logs.warn.length = 0;
    logs.error.length = 0;

    mock.module('../../src/services/auth/token-manager', () => ({
      clearAuthToken: clearAuthTokenMock,
    }));

    mock.module('../../src/utils/logger', () => ({
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
    mock.clearAllMocks();
    mock.restore();
    // Workaround for https://github.com/oven-sh/bun/issues/7823 due to ESM caching.
    mock.module('../../src/services/auth/token-manager', () => ({ ...originalTokenManager }));
    mock.module('../../src/utils/logger', () => ({ ...originalLogger }));
  });

  it('clears stored tokens and logs success', async () => {
    const { runCli } = await import('../../src/cli');

    await runCli(['auth', 'logout']);

    expect(clearAuthTokenMock).toHaveBeenCalledTimes(1);
    expect(logs.success.some((message) => message.includes('Logged out'))).toBe(true);
  });
});
