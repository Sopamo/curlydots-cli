import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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
    fetchCalls.length = 0;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.exitCode = 0;
  });

  afterEach(() => {
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
    const cleanErrors = errorMessages.map(msg => msg.replace(/\x1b\[[0-9;]*m/g, ''));
    expect(cleanErrors.some(msg => 
      msg.includes('No project specified') && 
      msg.includes('Use --project or run')
    )).toBe(true);
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

    await writeFile(join(appTranslations, 'common.js'), 'module.exports = { save: "Save" };\n', 'utf8');
    await writeFile(join(usersTranslations, 'users.js'), 'module.exports = { invite: "Invite" };\n', 'utf8');
    await writeFile(join(langTranslations, 'admin.js'), 'module.exports = { publish: "Publish" };\n', 'utf8');
    await writeFile(
      join(projectRoot, 'usage.ts'),
      [
        "const save = t('common.save');",
        "const invite = t('users.invite');",
        "const publish = t('admin.publish');",
      ].join('\n'),
      'utf8',
    );

    const mockGetCurrentProject = mock((baseDir?: string) => ({
      projectId: `project-from-${baseDir}`,
      projectName: 'Selected Project',
      teamName: 'Test Team',
    }));
    const mockLoadCliConfig = mock((_baseDir?: string) => ({
      apiEndpoint: 'https://curlydots.com/api',
      frontendUrl: 'https://curlydots.com',
      timeout: 500,
      retries: 0,
      debug: false,
      defaultLocale: undefined,
      sources: {
        apiEndpoint: { source: 'default' as const },
        frontendUrl: { source: 'default' as const },
        debug: { source: 'default' as const },
      },
    }));
    const mockLoadCliAuthConfig = mock((_baseDir?: string) => ({
      authMethod: 'api_key' as const,
      tokenStorage: 'file' as const,
      token: 'project-token',
    }));

    mock.module('../../src/config/project-config', () => ({
      getCurrentProject: mockGetCurrentProject,
      setCurrentProject: mock(() => {}),
      clearCurrentProject: mock(() => {}),
    }));

    mock.module('../../src/config/cli-config', () => ({
      loadCliConfig: mockLoadCliConfig,
    }));

    mock.module('../../src/config/auth-config', () => ({
      loadCliAuthConfig: mockLoadCliAuthConfig,
    }));

    const { runTranslationsPush } = await import('../../src/commands/translations/push');

    await runTranslationsPush([
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
      '--api-host',
      'https://curlydots.com/api',
    ]);

    expect(mockGetCurrentProject).toHaveBeenCalledWith(projectRoot);
    expect(mockLoadCliConfig).toHaveBeenCalledWith(projectRoot);
    expect(mockLoadCliAuthConfig).toHaveBeenCalledWith(projectRoot);
  });

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
    expect(getCall?.input).toContain('https://staging.curlydots.test/api/projects/project-123/translation-keys');
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
    expect(getCall?.input).toContain('https://override.curlydots.test/api/projects/project-123/translation-keys');
    expect(getCall?.input).not.toContain('https://configured.curlydots.test/api/projects/project-123/translation-keys');
  });
});
