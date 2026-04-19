import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');
type FetchArgs = Parameters<typeof fetch>;

describe('integration/push-translations', () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ input: FetchArgs[0]; init?: FetchArgs[1] }> = [];
  let tempDir = '';
  const fetchMock = mock(async (...args: FetchArgs) => {
    const [input, init] = args;
    fetchCalls.push({ input, init });
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      return new Response(JSON.stringify({ data: { keys: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({}), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  beforeEach(() => {
    fetchCalls.length = 0;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.exitCode = undefined;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.exitCode = undefined;
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('pushes translation keys with context payload', async () => {
    const { runTranslationsPush } = await import('../../src/commands/translations/push');

    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      TEST_REPO,
      '--translations-dir',
      'translations',
      '--source',
      'en',
      '--parser',
      'node-module',
      '--api-host',
      'https://curlydots.com/api',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [getCall, postCall] = fetchCalls;
    expect(getCall?.input.toString()).toContain('/api/projects/project-123/translation-keys');
    expect(postCall?.input.toString()).toContain('/api/projects/project-123/translation-keys');
    const body = JSON.parse((postCall?.init?.body as string) ?? '{}') as {
      entries?: Array<Record<string, unknown>>;
      current_batch?: number;
      total_batch?: number;
    };

    expect(Array.isArray(body.entries)).toBe(true);
    expect(body.entries?.length).toBeGreaterThan(0);
    expect(body.current_batch).toBe(1);
    expect(body.total_batch).toBe(1);

    const first = body.entries?.[0] as Record<string, unknown> | undefined;
    expect(first?.translationKey).toBeDefined();
    expect(first?.sourceValue).toBeDefined();
    expect(first?.sourceLanguage).toBe('en');
    expect(Array.isArray(first?.codeContext)).toBe(true);
  });

  it('skips keys that already exist on the backend', async () => {
    const { runTranslationsPush } = await import('../../src/commands/translations/push');

    fetchMock.mockImplementationOnce(async (...args: FetchArgs) => {
      const [input, init] = args;
      fetchCalls.push({ input, init });
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        return new Response(JSON.stringify({ data: { keys: ['generic.back', 'generic.save'] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      TEST_REPO,
      '--translations-dir',
      'translations',
      '--source',
      'en',
      '--parser',
      'node-module',
      '--api-host',
      'https://curlydots.com/api',
      '--api-token',
      'token-abc',
    ]);

    const postCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') !== 'GET');
    const body = JSON.parse((postCall?.init?.body as string) ?? '{}') as {
      entries?: Array<Record<string, unknown>>;
    };

    expect(body.entries?.some((key) => key.translationKey === 'generic.back')).toBe(false);
    expect(body.entries?.some((key) => key.translationKey === 'generic.save')).toBe(false);
  });

  it('merges translation keys across multiple translation directories', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'push-translations-multi-dir-'));
    await mkdir(join(tempDir, 'translations-a', 'en'), { recursive: true });
    await mkdir(join(tempDir, 'translations-b', 'en'), { recursive: true });
    await writeFile(
      join(tempDir, 'translations-a', 'en', 'common.js'),
      'module.exports = { save: "Save" };\n',
      'utf8',
    );
    await writeFile(
      join(tempDir, 'translations-b', 'en', 'admin.js'),
      'module.exports = { publish: "Publish" };\n',
      'utf8',
    );
    await writeFile(
      join(tempDir, 'usage.ts'),
      ["const save = t('common.save');", "const publish = t('admin.publish');"].join('\n'),
      'utf8',
    );

    const { runTranslationsPush } = await import('../../src/commands/translations/push');

    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      tempDir,
      '--translations-dir',
      'translations-a',
      '--translations-dir',
      'translations-b',
      '--source',
      'en',
      '--parser',
      'node-module',
      '--api-host',
      'https://curlydots.com/api',
      '--api-token',
      'token-abc',
      '--extensions',
      '.ts',
    ]);

    const postCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') !== 'GET');
    const body = JSON.parse((postCall?.init?.body as string) ?? '{}') as {
      entries?: Array<Record<string, unknown>>;
    };

    expect(body.entries?.some((key) => key.translationKey === 'common.save')).toBe(true);
    expect(body.entries?.some((key) => key.translationKey === 'admin.publish')).toBe(true);
  });
});
