import { describe, expect, it } from 'bun:test';
import { runBrowserLogin, type AuthToken, type LoginResponse, type PollResponse } from '../../src/services/auth/browser-login';
import { HttpClient } from '../../src/services/http/client';
import type { CliConfig } from '../../src/config/cli-config';
import { Logger } from '../../src/utils/logger';

class FakeClient extends HttpClient {
  public loginResponse: LoginResponse;
  public pollResponses: PollResponse[] = [];
  public postCalls = 0;
  public getCalls = 0;

  constructor(loginResponse: LoginResponse, pollResponses: PollResponse[]) {
    super({ baseUrl: 'https://example.com', timeout: 1000, retries: 0 });
    this.loginResponse = loginResponse;
    this.pollResponses = pollResponses;
  }

  override async post<LoginResponse>(path: string): Promise<LoginResponse> {
    this.postCalls += 1;
    expect(path).toBe('/auth/login');
    return this.loginResponse as LoginResponse;
  }

  override async get<PollResponse>(_path: string): Promise<PollResponse> {
    this.getCalls += 1;
    if (this.pollResponses.length === 0) {
      throw new Error('No more poll responses');
    }
    return this.pollResponses.shift() as PollResponse;
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
  it('completes browser login flow with polling', async () => {
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

    const pollResponses: PollResponse[] = [
      { status: 'pending' },
      { status: 'completed', token },
    ];

    const fakeClient = new FakeClient(loginResponse, pollResponses);
    const opened: string[] = [];
    const saved: string[] = [];

    const result = await runBrowserLogin({
      client: fakeClient,
      config: baseConfig,
      openBrowser: async (url: string) => {
        opened.push(url);
      },
      wait: async () => {},
      saveToken: async (value: string) => {
        saved.push(value);
      },
      logger: noopLogger,
    } as never);

    expect(result.accessToken).toBe(token.accessToken);
    expect(opened).toEqual([loginResponse.browserUrl]);
    expect(saved.length).toBe(1);
    expect(JSON.parse(saved[0]!)).toEqual(token);
    expect(fakeClient.postCalls).toBe(1);
    expect(fakeClient.getCalls).toBe(2);
  });

  it('fails when polling returns failure', async () => {
    const loginResponse: LoginResponse = {
      browserUrl: AUTH_BROWSER_URL + '/login',
      pollingUrl: AUTH_BROWSER_URL + '/auth-poll/123',
      pairingCode: 'ABCD',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const pollResponses: PollResponse[] = [{ status: 'failed', error: 'Invalid session' }];
    const fakeClient = new FakeClient(loginResponse, pollResponses);

    await expect(
      runBrowserLogin({
        client: fakeClient,
        config: baseConfig,
        openBrowser: async () => {},
        wait: async () => {},
        saveToken: async () => {},
        logger: noopLogger,
      } as never),
    ).rejects.toThrow('Invalid session');
  });
});
