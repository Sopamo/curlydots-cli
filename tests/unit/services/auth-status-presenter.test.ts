import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { HttpClient, HttpClientError } from '../../../src/services/http/client';

const ORIGINAL_ENV = { ...process.env };

const mockLoadCliConfig = mock(() => ({
  apiEndpoint: 'http://curlydots.com/api',
  authMethod: 'browser',
  tokenStorage: 'keychain',
  timeout: 1000,
  retries: 0,
  debug: false,
  token: undefined,
  defaultLocale: undefined,
}));

const mockLoadAuthToken = mock<() => Promise<unknown>>(async () => null);
const mockIsTokenExpired = mock(() => false);
const mockHttpClientGet = mock(async () => ({
  authenticated: true,
  expires_at: '2026-01-01T00:00:00Z',
}));
const mockFromConfig = mock(() => ({
  get: mockHttpClientGet,
}));
const originalHttpClientFromConfig = HttpClient.fromConfig;

describe('services/auth/status-presenter', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CURLYDOTS_TOKEN;
    mockHttpClientGet.mockClear();
    mockLoadAuthToken.mockClear();
    mockIsTokenExpired.mockClear();
    mockFromConfig.mockClear();

    mock.module('../../../src/config/cli-config', () => ({
      loadCliConfig: mockLoadCliConfig,
    }));

    mock.module('../../../src/services/auth/token-manager', () => ({
      loadAuthToken: mockLoadAuthToken,
      isTokenExpired: mockIsTokenExpired,
    }));

    HttpClient.fromConfig = mockFromConfig as unknown as typeof HttpClient.fromConfig;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    mock.clearAllMocks();
    mock.restore();
    HttpClient.fromConfig = originalHttpClientFromConfig;
  });

  it('reports authenticated when env token is valid', async () => {
    process.env.CURLYDOTS_TOKEN = 'env-token';

    const { getAuthStatus } = await import('../../../src/services/auth/status-presenter');
    const status = await getAuthStatus();

    expect(status.authenticated).toBe(true);
    expect(status.storage).toBe('environment');
  });

  it('reports unauthenticated when env token is rejected', async () => {
    process.env.CURLYDOTS_TOKEN = 'env-token';
    mockHttpClientGet.mockRejectedValueOnce(new HttpClientError('Token deactivated', { category: 'authentication' }));

    const { getAuthStatus } = await import('../../../src/services/auth/status-presenter');
    const status = await getAuthStatus();

    expect(status.authenticated).toBe(false);
    expect(status.storage).toBe('environment');
  });

  it('reports authenticated when stored token is valid', async () => {
    mockLoadAuthToken.mockResolvedValueOnce({
      accessToken: 'stored-token',
      expiresAt: '2026-01-01T00:00:00Z',
    });

    const { getAuthStatus } = await import('../../../src/services/auth/status-presenter');
    const status = await getAuthStatus();

    expect(status.authenticated).toBe(true);
    expect(status.storage).toBe('keychain');
  });
});
