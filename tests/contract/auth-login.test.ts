import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AuthToken, LoginResponse, PollResponse } from '../../src/services/auth/browser-login';
import { HttpClient, type HttpRequestOptions } from '../../src/services/http/client';
import type { CliConfig } from '../../src/config/cli-config';
import { Logger } from '../../src/utils/logger';

interface FakePollEntry {
  body?: PollResponse;
  status?: number;
  headers?: Record<string, string>;
  error?: string;
}

class FakeClient extends HttpClient {
  public loginResponse: { code: string; verification_url: string; expires_at: string; poll_token: string };
  public pollResponses: FakePollEntry[] = [];
  public postCalls = 0;
  public getCalls = 0;
  public requestHeaders: Record<string, string>[] = [];
  public cancelCalls: Array<{ path: string; body: unknown }> = [];

  constructor(
    loginResponse: { code: string; verification_url: string; expires_at: string; poll_token: string },
    pollResponses: FakePollEntry[],
  ) {
    super({ baseUrl: 'https://curlydots.com', timeout: 1000, retries: 0 });
    this.loginResponse = loginResponse;
    this.pollResponses = pollResponses;
  }

  override async post<LoginResponse>(path: string, body?: unknown): Promise<LoginResponse> {
    this.postCalls += 1;
    if (path === 'cli/pairings') {
      return this.loginResponse as LoginResponse;
    }
    this.cancelCalls.push({ path, body });
    return undefined as LoginResponse;
  }

  override async get<PollResponse>(_path: string, options?: HttpRequestOptions): Promise<PollResponse> {
    this.getCalls += 1;
    this.requestHeaders.push({ ...(options?.headers ?? {}) });
    if (this.pollResponses.length === 0) {
      throw new Error('No more poll responses');
    }
    const entry = this.pollResponses.shift() as FakePollEntry;
    const status = entry.status ?? 200;
    const headers = new Headers(entry.headers ?? {});

    options?.onResponse?.({
      status,
      headers,
    } as Response);

    const accepted = options?.acceptStatuses?.includes(status) ?? false;
    if (status >= 400 && !accepted) {
      throw new Error(entry.error ?? `HTTP ${status}`);
    }

    if (status === 304) {
      return undefined as PollResponse;
    }

    if (!entry.body) {
      throw new Error('Missing response data');
    }

    return entry.body as PollResponse;
  }
}

const AUTH_BROWSER_URL = process.env.CURLYDOTS_AUTH_BROWSER_URL ?? 'https://curlydots.com/cli';
const API_ENDPOINT = process.env.CURLYDOTS_API_ENDPOINT ?? 'https://curlydots.com/api';

const baseConfig: CliConfig = {
  apiEndpoint: API_ENDPOINT,
  authMethod: 'browser',
  tokenStorage: 'keychain',
  timeout: 5000,
  retries: 0,
  debug: false,
};

const noopLogger = new Logger({ silent: true });

describe('contract/auth-login', () => {
  beforeEach(() => {
    mock.restore();
  });

  it('completes browser login flow with polling', async () => {
    const { runBrowserLogin } = await import('../../src/services/auth/browser-login');
    const loginResponse: LoginResponse = {
      browserUrl: AUTH_BROWSER_URL + '/login',
      pollingUrl: AUTH_BROWSER_URL + '/auth-poll/123',
      pairingCode: 'ABCD',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const token: AuthToken = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      scope: ['translations:write'],
    };

    const pollResponses: FakePollEntry[] = [
      { body: { status: 'pending' } },
      { body: { status: 'approved', token_payload: token } },
    ];

    const fakeClient = new FakeClient(loginResponse, pollResponses);
    const opened: string[] = [];

    const result = await runBrowserLogin({
      client: fakeClient,
      config: baseConfig,
      openBrowser: async (url: string) => {
        opened.push(url);
      },
      wait: async () => {},
      logger: noopLogger,
    });

    expect(result.accessToken).toBe(token.accessToken);
    expect(result.refreshToken).toBe(token.refreshToken);
    expect(opened).toEqual([loginResponse.verification_url]);
    expect(fakeClient.postCalls).toBe(1);
    expect(fakeClient.getCalls).toBe(2);
  });

  it('fails when polling returns failure', async () => {
    const { runBrowserLogin } = await import('../../src/services/auth/browser-login');
    const loginResponse: LoginResponse = {
      browserUrl: AUTH_BROWSER_URL + '/login',
      pollingUrl: AUTH_BROWSER_URL + '/auth-poll/123',
      pairingCode: 'ABCD',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const pollResponses: FakePollEntry[] = [{ body: { status: 'denied', denied_reason: 'Invalid session' } }];
    const fakeClient = new FakeClient(loginResponse, pollResponses);

    await expect(
      runBrowserLogin({
        client: fakeClient,
        config: baseConfig,
        openBrowser: async () => {},
        wait: async () => {},
        logger: noopLogger,
      }),
    ).rejects.toThrow('Invalid session');
  });

  it('reuses conditional headers and skips JSON parsing on 304', async () => {
    const { runBrowserLogin } = await import('../../src/services/auth/browser-login');
    const loginResponse: LoginResponse = {
      browserUrl: AUTH_BROWSER_URL + '/login',
      pollingUrl: AUTH_BROWSER_URL + '/auth-poll/123',
      pairingCode: 'ABCD',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const token: AuthToken = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      scope: ['translations:write'],
    };

    const etag = '"etag-1"';
    const lastModified = 'Wed, 01 Jan 2025 12:00:00 GMT';

    const pollResponses: FakePollEntry[] = [
      {
        body: { status: 'pending' },
        headers: { ETag: etag, 'Last-Modified': lastModified },
      },
      {
        status: 304,
        headers: { ETag: etag, 'Last-Modified': lastModified },
      },
      {
        body: { status: 'approved', token_payload: token },
        headers: { ETag: '"etag-2"' },
      },
    ];

    const fakeClient = new FakeClient(loginResponse, pollResponses);

    const result = await runBrowserLogin({
      client: fakeClient,
      config: baseConfig,
      openBrowser: async () => {},
      wait: async () => {},
      logger: noopLogger,
    });

    expect(result.accessToken).toBe(token.accessToken);
    expect(fakeClient.getCalls).toBe(3);
    expect(fakeClient.requestHeaders).toHaveLength(3);
    const [first, second, third] = fakeClient.requestHeaders;
    expect(first?.['If-None-Match']).toBeUndefined();
    expect(second?.['If-None-Match']).toBe(etag);
    expect(second?.['If-Modified-Since']).toBe(lastModified);
    expect(third?.['If-None-Match']).toBe(etag);
    expect(third?.['If-Modified-Since']).toBe(lastModified);
  });

  it('notifies backend when authentication is cancelled', async () => {
    const loginResponse = {
      code: 'ABCDEFGH',
      verification_url: AUTH_BROWSER_URL + '/login',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      poll_token: 'poll-token',
    };

    const pollResponses: FakePollEntry[] = [{ body: { status: 'pending' } }];
    const fakeClient = new FakeClient(loginResponse, pollResponses);
    const controller = new AbortController();
    let abortTriggered = false;

    await expect(
      runBrowserLogin({
        client: fakeClient,
        config: baseConfig,
        openBrowser: async () => {},
        wait: async () => {
          if (!abortTriggered) {
            abortTriggered = true;
            controller.abort();
          }
        },
        logger: noopLogger,
        signal: controller.signal,
      }),
    ).rejects.toThrow('Authentication cancelled by user.');

    expect(fakeClient.cancelCalls).toHaveLength(1);
    expect(fakeClient.cancelCalls[0]).toEqual({
      path: 'cli/pairings/ABCDEFGH/cancel',
      body: { poll_token: 'poll-token' },
    });
  });
});
