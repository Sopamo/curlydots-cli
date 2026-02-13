import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

const TEST_REPO = join(import.meta.dir, '../fixtures/sample-repo');
type FetchArgs = Parameters<typeof fetch>;

describe('integration/push-translations-project-override', () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ input: FetchArgs[0]; init?: FetchArgs[1] }> = [];
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
});
