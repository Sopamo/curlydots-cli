import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as authConfigModule from '../../src/config/auth-config';
import * as cliConfigModule from '../../src/config/cli-config';
import * as projectConfigModule from '../../src/config/project-config';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');
type FetchArgs = Parameters<typeof fetch>;
const originalAuthConfig = { ...authConfigModule };
const originalCliConfig = { ...cliConfigModule };
const originalProjectConfig = { ...projectConfigModule };
const originalEnvironmentToken = process.env.CURLYDOTS_TOKEN;

function stripAnsiCodes(value: string): string {
  const escapeCharacter = String.fromCharCode(27);
  let output = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === escapeCharacter && value[index + 1] === '[') {
      index += 2;
      while (index < value.length && value[index] !== 'm') {
        index += 1;
      }
      continue;
    }

    output += value[index];
  }

  return output;
}

describe('integration/push-translations-project-override', () => {
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
    process.env.CURLYDOTS_TOKEN = undefined;
    fetchCalls.length = 0;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.exitCode = 0;
  });

  afterEach(() => {
    process.env.CURLYDOTS_TOKEN = originalEnvironmentToken;
    globalThis.fetch = originalFetch;
    process.exitCode = undefined;
    mock.clearAllMocks();
    mock.restore();
    mock.module('../../src/config/auth-config', () => ({ ...originalAuthConfig }));
    mock.module('../../src/config/cli-config', () => ({ ...originalCliConfig }));
    mock.module('../../src/config/project-config', () => ({ ...originalProjectConfig }));
    if (tempDir) {
      rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('falls back to selected project when --project not provided', async () => {
    // Mock getCurrentProject to return a selected project
    const mockGetCurrentProject = mock(() => ({
      projectId: 'selected-project-456',
      projectName: 'Selected Project',
      teamName: 'Test Team',
    }));

    mock.module('../../src/config/project-config', () => ({
      getCurrentProject: mockGetCurrentProject,
      setCurrentProject: mock(() => {}),
      clearCurrentProject: mock(() => {}),
    }));

    const { runTranslationsPush } = await import('../../src/commands/translations/push');

    await runTranslationsPush([
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

    // Verify the API calls use the selected project UUID
    expect(fetchCalls.length).toBeGreaterThan(0);

    const getCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') === 'GET');
    expect(getCall?.input).toContain('projects/selected-project-456/translation-keys');

    const postCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') !== 'GET');
    expect(postCall?.input).toContain('projects/selected-project-456/translation-keys');
  });

  it('errors when no project is selected and --project not provided', async () => {
    // Mock getCurrentProject to return null (no project selected)
    const mockGetCurrentProject = mock(() => null);

    mock.module('../../src/config/project-config', () => ({
      getCurrentProject: mockGetCurrentProject,
      setCurrentProject: mock(() => {}),
      clearCurrentProject: mock(() => {}),
    }));

    const { runTranslationsPush } = await import('../../src/commands/translations/push');

    // Mock console.error to capture error message
    const errorMessages: string[] = [];
    const originalConsoleError = console.error;
    console.error = (message: string) => {
      errorMessages.push(message);
    };

    await runTranslationsPush([
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

    // Restore console.error
    console.error = originalConsoleError;

    // Verify error message (strip ANSI codes for comparison)
    const cleanErrors = errorMessages.map(stripAnsiCodes);
    expect(
      cleanErrors.some(
        (msg) => msg.includes('No project specified') && msg.includes('Use --project or run'),
      ),
    ).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('uses --project override when provided', async () => {
    // Mock getCurrentProject to return a selected project
    const mockGetCurrentProject = mock(() => ({
      projectId: 'selected-project-456',
      projectName: 'Selected Project',
      teamName: 'Test Team',
    }));

    mock.module('../../src/config/project-config', () => ({
      getCurrentProject: mockGetCurrentProject,
      setCurrentProject: mock(() => {}),
      clearCurrentProject: mock(() => {}),
    }));

    const { runTranslationsPush } = await import('../../src/commands/translations/push');

    await runTranslationsPush([
      '--project',
      'override-project-789',
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

    // Verify the API calls use the override project UUID, not the selected one
    expect(fetchCalls.length).toBeGreaterThan(0);

    const getCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') === 'GET');
    expect(getCall?.input).toContain('projects/override-project-789/translation-keys');
    expect(getCall?.input).not.toContain('projects/selected-project-456/translation-keys');

    const postCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') !== 'GET');
    expect(postCall?.input).toContain('projects/override-project-789/translation-keys');
    expect(postCall?.input).not.toContain('projects/selected-project-456/translation-keys');
  });

  it('uses the common ancestor of resolved translation directories for project, config, and auth lookup', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'push-translations-config-root-'));
    const projectRoot = join(tempDir, 'projects-root');
    const appTranslations = join(projectRoot, 'modules', 'app', 'translations', 'en');
    const usersTranslations = join(projectRoot, 'modules', 'users', 'translations', 'en');
    const langTranslations = join(projectRoot, 'lang', 'translations', 'en');

    await mkdir(appTranslations, { recursive: true });
    await mkdir(usersTranslations, { recursive: true });
    await mkdir(langTranslations, { recursive: true });

    await writeFile(
      join(appTranslations, 'common.js'),
      'module.exports = { save: "Save" };\n',
      'utf8',
    );
    await writeFile(
      join(usersTranslations, 'users.js'),
      'module.exports = { invite: "Invite" };\n',
      'utf8',
    );
    await writeFile(
      join(langTranslations, 'admin.js'),
      'module.exports = { publish: "Publish" };\n',
      'utf8',
    );
    await writeFile(
      join(projectRoot, 'usage.ts'),
      [
        "const save = t('common.save');",
        "const invite = t('users.invite');",
        "const publish = t('admin.publish');",
      ].join('\n'),
      'utf8',
    );

    const requests: Array<{ method: string; path: string; authorization: string | null }> = [];
    let uploadedKeys: string[] = [];
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: async (request) => {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          authorization: request.headers.get('Authorization'),
        });
        if (request.method === 'POST') {
          const body = (await request.json()) as { entries: Array<{ translationKey: string }> };
          uploadedKeys = body.entries.map((entry) => entry.translationKey);
          return Response.json(
            { accepted: uploadedKeys.length, skipped: 0, duplicates: 0 },
            { status: 201 },
          );
        }
        return Response.json({ data: { keys: [] } });
      },
    });

    try {
      const globalConfigurationDirectory = join(tempDir, '.curlydots');
      await mkdir(globalConfigurationDirectory);
      await writeFile(
        join(globalConfigurationDirectory, 'config.json'),
        JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'http://127.0.0.1:9/api',
          frontendUrl: 'http://127.0.0.1:9',
        }),
      );
      await writeFile(
        join(globalConfigurationDirectory, 'current-project.json'),
        JSON.stringify({
          projectId: 'global-project',
          projectName: 'Global Project',
          teamName: 'Global Team',
        }),
      );
      await writeFile(
        join(globalConfigurationDirectory, 'auth.json'),
        JSON.stringify({
          schemaVersion: 1,
          authMethod: 'api_key',
          tokenStorage: 'file',
          token: 'global-token',
        }),
        { mode: 0o600 },
      );
      const configurationDirectory = join(projectRoot, '.curlydots');
      await mkdir(configurationDirectory);
      await writeFile(
        join(configurationDirectory, 'current-project.json'),
        JSON.stringify({
          projectId: 'common-ancestor-project',
          projectName: 'Selected Project',
          teamName: 'Test Team',
        }),
      );
      await writeFile(
        join(configurationDirectory, 'config.json'),
        JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: `http://127.0.0.1:${server.port}/api`,
          frontendUrl: `http://127.0.0.1:${server.port}`,
          debug: false,
        }),
      );
      await writeFile(
        join(configurationDirectory, 'auth.json'),
        JSON.stringify({
          schemaVersion: 1,
          authMethod: 'api_key',
          tokenStorage: 'file',
          token: 'project-token',
        }),
        { mode: 0o600 },
      );

      const child = Bun.spawn(
        [
          process.execPath,
          'run',
          '--tsconfig-override',
          join(import.meta.dir, '../../tsconfig.json'),
          join(import.meta.dir, '../../src/index.ts'),
          'translations',
          'push',
          '--repo',
          projectRoot,
          '--translations-dir',
          'modules/app/translations',
          '--translations-dir',
          'modules/users/translations',
          '--translations-dir',
          'lang/translations',
          '--source',
          'en',
          '--parser',
          'node-module',
        ],
        {
          cwd: tempDir,
          env: {
            ...process.env,
            HOME: tempDir,
            CURLYDOTS_TOKEN: '',
            CURLYDOTS_DISABLE_KEYTAR: '1',
            CURLYDOTS_HOME: join(tempDir, 'token-store'),
          },
          stdout: 'pipe',
          stderr: 'pipe',
        },
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
      expect(stdout).toContain('Uploaded: 3');
      expect(requests).toEqual([
        {
          method: 'GET',
          path: '/api/projects/common-ancestor-project/translation-keys',
          authorization: 'Bearer project-token',
        },
        {
          method: 'POST',
          path: '/api/projects/common-ancestor-project/translation-keys',
          authorization: 'Bearer project-token',
        },
      ]);
      expect(uploadedKeys.sort()).toEqual(['admin.publish', 'common.save', 'users.invite']);
    } finally {
      server.stop(true);
    }
  }, 30_000);

  it('uses configured apiEndpoint when --api-host is not provided', async () => {
    const mockLoadCliConfig = mock((_baseDir?: string) => ({
      apiEndpoint: 'https://staging.curlydots.test/api',
      frontendUrl: 'https://staging.curlydots.test',
      timeout: 500,
      retries: 0,
      debug: false,
      defaultLocale: undefined,
      sources: {
        apiEndpoint: { source: 'project' as const, path: '/tmp/.curlydots/config.json' },
        frontendUrl: { source: 'project' as const, path: '/tmp/.curlydots/config.json' },
        debug: { source: 'default' as const },
      },
    }));

    mock.module('../../src/config/cli-config', () => ({
      loadCliConfig: mockLoadCliConfig,
    }));

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
      '--api-token',
      'token-abc',
    ]);

    expect(mockLoadCliConfig).toHaveBeenCalled();
    const getCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') === 'GET');
    expect(getCall?.input).toContain(
      'https://staging.curlydots.test/api/projects/project-123/translation-keys',
    );
  });

  it('prefers --api-host over configured apiEndpoint', async () => {
    const mockLoadCliConfig = mock((_baseDir?: string) => ({
      apiEndpoint: 'https://configured.curlydots.test/api',
      frontendUrl: 'https://configured.curlydots.test',
      timeout: 500,
      retries: 0,
      debug: false,
      defaultLocale: undefined,
      sources: {
        apiEndpoint: { source: 'project' as const, path: '/tmp/.curlydots/config.json' },
        frontendUrl: { source: 'project' as const, path: '/tmp/.curlydots/config.json' },
        debug: { source: 'default' as const },
      },
    }));

    mock.module('../../src/config/cli-config', () => ({
      loadCliConfig: mockLoadCliConfig,
    }));

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
      'https://override.curlydots.test/api',
      '--api-token',
      'token-abc',
    ]);

    expect(mockLoadCliConfig).toHaveBeenCalled();
    const getCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') === 'GET');
    expect(getCall?.input).toContain(
      'https://override.curlydots.test/api/projects/project-123/translation-keys',
    );
    expect(getCall?.input).not.toContain(
      'https://configured.curlydots.test/api/projects/project-123/translation-keys',
    );
  });
});
