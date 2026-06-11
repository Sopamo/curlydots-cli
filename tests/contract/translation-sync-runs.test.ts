import { describe, expect, it } from 'bun:test';
import { HttpClient } from '../../src/services/http/client';
import type { TranslationSyncKeyPayload } from '../../src/types/translation-sync';

class FakeClient extends HttpClient {
  public postCalls: Array<{ path: string; token?: string; body?: unknown }> = [];

  constructor() {
    super({ baseUrl: 'https://curlydots.com', timeout: 1000, retries: 0 });
  }

  override async post<T, B = unknown>(path: string, body?: B, token?: string): Promise<T> {
    this.postCalls.push({ path, token, body });

    return {
      data: {
        run_id: 'run-123',
        status: 'processing',
        imported_keys_count: 2,
        queued_batches_count: 1,
      },
    } as T;
  }
}

describe('contract/translation-sync-runs', () => {
  it('starts a sync run using team and project slugs', async () => {
    const { startTranslationSyncRun } = await import(
      '../../src/services/api/translation-sync-runs'
    );
    const client = new FakeClient();
    const payload: TranslationSyncKeyPayload[] = [
      { key: 'generic.save', default_value: 'Save', context: 'Button label' },
      { key: 'generic.cancel', default_value: 'Cancel' },
    ];

    const result = await startTranslationSyncRun(
      client,
      'team-a',
      'project-a',
      'token-abc',
      payload,
    );

    expect(result).toEqual({
      runId: 'run-123',
      status: 'processing',
      importedKeysCount: 2,
      queuedBatchesCount: 1,
    });
    expect(client.postCalls).toEqual([
      {
        path: '/api/teams/team-a/projects/project-a/translation-sync-runs',
        token: 'token-abc',
        body: { keys: payload },
      },
    ]);
  });
});
