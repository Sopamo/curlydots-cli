import { describe, expect, it, mock } from 'bun:test';
import { HttpClient } from '../../src/services/http/client';
import type { TranslationKeyPayload } from '../../src/types/translation-keys';

class FakeClient extends HttpClient {
  public getCalls: Array<{ path: string; token?: string }> = [];
  public postCalls: Array<{ path: string; token?: string; body?: unknown }> = [];

  constructor() {
    super({ baseUrl: 'https://curlydots.com', timeout: 1000, retries: 0 });
  }

  override async get<T>(path: string, options?: { token?: string }): Promise<T> {
    this.getCalls.push({ path, token: options?.token });
    return { keys: ['alpha', 'beta'] } as T;
  }

  override async post<T, B = unknown>(path: string, body?: B, token?: string): Promise<T> {
    this.postCalls.push({ path, token, body });
    return undefined as T;
  }
}

describe('contract/translation-keys', () => {
  it('fetches existing keys using project endpoint + auth token', async () => {
    const { fetchExistingTranslationKeys } = await import('../../src/services/api/translation-keys');
    const client = new FakeClient();

    const response = await fetchExistingTranslationKeys(client, 'project-123', 'token-abc');

    expect(response.keys).toEqual(['alpha', 'beta']);
    expect(client.getCalls).toEqual([
      { path: '/api/projects/project-123/translation-keys', token: 'token-abc' },
    ]);
  });

  it('uploads keys in batches to the translation keys endpoint', async () => {
    const { uploadTranslationKeys } = await import('../../src/services/api/translation-keys');
    const client = new FakeClient();
    const payload: TranslationKeyPayload[] = [
      { translationKey: 'a', sourceValue: 'A', sourceLanguage: 'en', codeContext: [] },
      { translationKey: 'b', sourceValue: 'B', sourceLanguage: 'en', codeContext: [] },
      { translationKey: 'c', sourceValue: 'C', sourceLanguage: 'en', codeContext: [] },
    ];

    const result = await uploadTranslationKeys(client, 'project-123', 'token-abc', payload, 2);

    expect(result).toEqual({ uploaded: 3, batches: 2 });
    expect(client.postCalls).toEqual([
      {
        path: '/api/projects/project-123/translation-keys',
        token: 'token-abc',
        body: { keys: payload.slice(0, 2), current_batch: 1, total_batch: 2 },
      },
      {
        path: '/api/projects/project-123/translation-keys',
        token: 'token-abc',
        body: { keys: payload.slice(2, 3), current_batch: 2, total_batch: 2 },
      },
    ]);
  });

  it('resolves auth token from provided override or stored token', async () => {
    const { resolveAuthToken } = await import('../../src/services/api/translation-keys');
    const stored = await resolveAuthToken({
      client: new FakeClient(),
      loadToken: async () => ({ accessToken: 'stored-token' }),
    });
    const override = await resolveAuthToken({ client: new FakeClient(), token: 'override' });

    expect(stored).toBe('stored-token');
    expect(override).toBe('override');
  });
});
