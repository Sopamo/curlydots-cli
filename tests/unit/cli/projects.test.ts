import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { projectsCommand } from '../../../src/commands/projects';
import type { CliConfig } from '../../../src/config/cli-config';
import { HttpClient } from '../../../src/services/http/client';

const logs = {
  warn: [] as string[],
};

const getCliAccessTokenMock = mock(async () => 'token');
const getExplicitAccessTokenMock = mock<
  () => { source: 'environment_token' | 'api_key'; storage: 'environment' | 'file'; token: string } | null
>(() => null);

const loadCliConfigMock = mock<() => CliConfig>(() => ({
  apiEndpoint: 'http://curlydots.com/api',
  frontendUrl: 'http://curlydots.com',
  timeout: 1000,
  retries: 0,
  debug: false,
  defaultLocale: undefined,
}));

const clearCurrentProjectMock = mock(() => {});
const getCurrentProjectMock = mock(() => ({
  projectId: 'stale-project',
  projectName: 'Stale Project',
  teamName: 'Old Team',
}));

const setCurrentProjectMock = mock(() => {});

const httpClientGetMock = mock(async () => ({
  data: [
    {
      id: 'active-project',
      name: 'Active Project',
      slug: 'active-project',
      team: { id: 1, name: 'Core Team' },
    },
  ],
}));

const originalLogger = await import('../../../src/utils/logger');
const originalConfigModule = await import('../../../src/config/cli-config');
const originalAuthServiceModule = await import('../../../src/services/auth/service');
const originalProjectConfigModule = await import('../../../src/config/project-config');
const originalReadlineModule = await import('node:readline');

const originalConsoleLog = console.log;
const originalHttpClientFromConfig = HttpClient.fromConfig;

describe('unit/cli/projects', () => {
  beforeEach(() => {
    logs.warn.length = 0;
    getCliAccessTokenMock.mockClear();
    getExplicitAccessTokenMock.mockClear();
    loadCliConfigMock.mockClear();
    clearCurrentProjectMock.mockClear();
    getCurrentProjectMock.mockClear();
    setCurrentProjectMock.mockClear();
    httpClientGetMock.mockClear();

    console.log = () => {};

    mock.module('../../../src/services/auth/service', () => ({
      getCliAccessToken: getCliAccessTokenMock,
      getExplicitAccessToken: getExplicitAccessTokenMock,
    }));

    mock.module('../../../src/config/cli-config', () => ({
      loadCliConfig: loadCliConfigMock,
    }));

    mock.module('../../../src/config/project-config', () => ({
      clearCurrentProject: clearCurrentProjectMock,
      getCurrentProject: getCurrentProjectMock,
      setCurrentProject: setCurrentProjectMock,
    }));

    HttpClient.fromConfig = () => ({
      get: httpClientGetMock,
    }) as unknown as HttpClient;

    mock.module('../../../src/utils/logger', () => ({
      ...originalLogger,
      globalLogger: {
        info: () => {},
        warn: (message: string) => logs.warn.push(message),
        error: () => {},
        spinner: () => {},
      },
    }));

    mock.module('node:readline', () => ({
      createInterface: () => ({
        question: (_prompt: string, cb: (answer: string) => void) => cb(''),
        close: () => {},
      }),
    }));
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    mock.clearAllMocks();
    mock.restore();
    mock.module('../../../src/services/auth/service', () => ({ ...originalAuthServiceModule }));
    mock.module('../../../src/config/cli-config', () => ({ ...originalConfigModule }));
    mock.module('../../../src/config/project-config', () => ({ ...originalProjectConfigModule }));
    HttpClient.fromConfig = originalHttpClientFromConfig;
    mock.module('node:readline', () => ({ ...originalReadlineModule }));
    mock.module('../../../src/utils/logger', () => ({ ...originalLogger }));
  });

  it('clears the stored project when it is no longer available', async () => {
    await projectsCommand([]);

    expect(clearCurrentProjectMock).toHaveBeenCalledTimes(1);
    expect(logs.warn.some((message) => message.includes('no longer available'))).toBe(true);
  });

  it('uses the shared CLI access token when loading projects', async () => {
    getCliAccessTokenMock.mockResolvedValueOnce('renewed-token');

    await projectsCommand([]);

    expect(getCliAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(httpClientGetMock).toHaveBeenCalledWith('cli/projects', {
      token: 'renewed-token',
    });
  });

  it('supports configured API tokens when loading projects', async () => {
    getCliAccessTokenMock.mockResolvedValueOnce('config-token');
    getExplicitAccessTokenMock.mockReturnValueOnce({
      source: 'api_key',
      storage: 'file',
      token: 'config-token',
    });

    await projectsCommand([]);

    expect(getCliAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(httpClientGetMock).toHaveBeenCalledWith('cli/projects', {
      token: 'config-token',
    });
  });
});
