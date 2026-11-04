import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { authStatusCommand } from '../../../src/commands/auth/status';
import type { AuthStatus } from '../../../src/services/auth/service';
import * as authServiceModule from '../../../src/services/auth/service';
import * as loggerModule from '../../../src/utils/logger';

const logs = {
  success: [] as string[],
  warn: [] as string[],
};

const getAuthStatusMock = mock<() => Promise<AuthStatus>>(async () => ({
  authenticated: false,
  expired: false,
  storage: 'keychain' as const,
  source: null,
}));

const originalAuthService = { ...authServiceModule };
const originalLogger = { ...loggerModule };

describe('unit/cli/auth-status', () => {
  beforeEach(() => {
    logs.success.length = 0;
    logs.warn.length = 0;
    getAuthStatusMock.mockClear();

    mock.module('../../../src/services/auth/service', () => ({
      getAuthStatus: getAuthStatusMock,
      formatAuthSourceLabel: (source: string | null, _storage: string) => {
        if (source === 'environment_token') return 'environment token (CURLYDOTS_TOKEN)';
        if (source === 'api_key') return 'API token from auth.json';
        return 'browser session (keychain)';
      },
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
    mock.module('../../../src/services/auth/service', () => ({ ...originalAuthService }));
    mock.module('../../../src/utils/logger', () => ({ ...originalLogger }));
  });

  it('warns when unauthenticated', async () => {
    getAuthStatusMock.mockResolvedValueOnce({
      authenticated: false,
      expired: false,
      storage: 'keychain' as const,
      source: null,
    });

    await authStatusCommand([]);

    expect(logs.warn.some((message) => message.includes('Not authenticated'))).toBe(true);
  });

  it('warns with expiry details when authentication is expired', async () => {
    const expiresAt = '2026-04-11T12:00:00.000Z';
    getAuthStatusMock.mockResolvedValueOnce({
      authenticated: false,
      expired: true,
      expiresAt,
      storage: 'keychain' as const,
      source: 'browser_session' as const,
    });

    await authStatusCommand([]);

    const message = logs.warn.join('\n');
    expect(message).toContain('Authentication expired');
    expect(message).toContain(expiresAt);
    expect(message).toContain('authenticate again');
  });

  it('shows success with expiry details when authenticated', async () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    getAuthStatusMock.mockResolvedValueOnce({
      authenticated: true,
      expired: false,
      expiresAt,
      storage: 'environment' as const,
      source: 'environment_token' as const,
    });

    await authStatusCommand([]);

    const message = logs.success.join('\n');
    expect(message).toContain('Authenticated via environment token (CURLYDOTS_TOKEN)');
    expect(message).toContain('expires');
  });

  it('shows API token source when authenticated with auth.json token', async () => {
    getAuthStatusMock.mockResolvedValueOnce({
      authenticated: true,
      expired: false,
      storage: 'file' as const,
      source: 'api_key' as const,
    });

    await authStatusCommand([]);

    const message = logs.success.join('\n');
    expect(message).toContain('Authenticated via API token from auth.json');
  });
});
