import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { authStatusCommand } from '../../../src/commands/auth/status';
import type { AuthStatus } from '../../../src/services/auth/status-presenter';
import * as statusPresenterModule from '../../../src/services/auth/status-presenter';
import * as authConfigModule from '../../../src/config/auth-config';
import * as loggerModule from '../../../src/utils/logger';

const logs = {
  success: [] as string[],
  warn: [] as string[],
};

const getAuthStatusMock = mock<() => Promise<AuthStatus>>(async () => ({
  authenticated: false,
  expired: false,
  storage: 'keychain' as const,
}));
const loadCliAuthConfigMock = mock(() => ({
  authMethod: 'browser' as const,
  tokenStorage: 'keychain' as const,
  token: undefined as string | undefined,
}));

const originalStatusPresenter = { ...statusPresenterModule };
const originalAuthConfig = { ...authConfigModule };
const originalLogger = { ...loggerModule };

describe('unit/cli/auth-status', () => {
  beforeEach(() => {
    logs.success.length = 0;
    logs.warn.length = 0;
    getAuthStatusMock.mockClear();

    mock.module('../../../src/services/auth/status-presenter', () => ({
      getAuthStatus: getAuthStatusMock,
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
        error: () => {},
        spinner: () => {},
      },
    }));
  });

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
    // Workaround for https://github.com/oven-sh/bun/issues/7823 due to ESM caching.
    mock.module('../../../src/services/auth/status-presenter', () => ({ ...originalStatusPresenter }));
    mock.module('../../../src/config/auth-config', () => ({ ...originalAuthConfig }));
    mock.module('../../../src/utils/logger', () => ({ ...originalLogger }));
  });

  it('warns when unauthenticated', async () => {
    getAuthStatusMock.mockResolvedValueOnce({
      authenticated: false,
      expired: false,
      storage: 'keychain' as const,
    });

    await authStatusCommand([]);

    expect(logs.warn.some((message) => message.includes('Not authenticated'))).toBe(true);
  });

  it('shows success with expiry details when authenticated', async () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    getAuthStatusMock.mockResolvedValueOnce({
      authenticated: true,
      expired: true,
      expiresAt,
      storage: 'environment' as const,
    });

    await authStatusCommand([]);

    const message = logs.success.join('\n');
    expect(message).toContain('Authenticated via environment token (CURLYDOTS_TOKEN)');
    expect(message).toContain('expires');
    expect(message).toContain('expired');
  });

  it('shows API token source when authenticated with auth.json token', async () => {
    getAuthStatusMock.mockResolvedValueOnce({
      authenticated: true,
      expired: false,
      storage: 'file' as const,
    });
    loadCliAuthConfigMock.mockReturnValueOnce({
      authMethod: 'api_key',
      tokenStorage: 'file',
      token: 'sk-example-token',
    });

    await authStatusCommand([]);

    const message = logs.success.join('\n');
    expect(message).toContain('Authenticated via API token from auth.json');
  });
});
