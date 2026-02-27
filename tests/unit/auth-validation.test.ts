import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');

const runTranslationsPushMock = async () => {
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
    'https://curlydots.com',
  ]);
};

const loadAuthTokenMock = mock(async () => null);
const loadCliAuthConfigMock = mock(() => ({
  authMethod: 'browser' as const,
  tokenStorage: 'keychain' as const,
  token: undefined as string | undefined,
}));

describe('auth validation', () => {
  beforeEach(() => {
    loadAuthTokenMock.mockClear();
    loadCliAuthConfigMock.mockClear();
    mock.module('../../src/services/auth/token-manager', () => ({
      loadAuthToken: loadAuthTokenMock,
    }));
    mock.module('../../src/config/auth-config', () => ({
      loadCliAuthConfig: loadCliAuthConfigMock,
    }));
    process.exitCode = undefined;
  });

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
    process.exitCode = 0;
  });

  it('fails fast when no token is available', async () => {
    await runTranslationsPushMock();

    expect(loadAuthTokenMock).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
