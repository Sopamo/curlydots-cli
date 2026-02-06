import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { projectsCommand } from '../../../src/commands/projects';
import type { CliConfig } from '../../../src/config/cli-config';
import { HttpClient } from '../../../src/services/http/client';

const logs = {
  warn: [] as string[],
};

const loadAuthTokenMock = mock(async () => ({
  accessToken: 'token',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
}));

const loadCliConfigMock = mock<() => CliConfig>(() => ({
  apiEndpoint: 'http://curlydots.com/api',
  authMethod: 'browser',
  tokenStorage: 'keychain',
  timeout: 1000,
  retries: 0,
  debug: false,
  token: undefined,
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
const originalAuthModule = await import('../../../src/services/auth/token-manager');
const originalConfigModule = await import('../../../src/config/cli-config');
const originalProjectConfigModule = await import('../../../src/config/project-config');
const originalReadlineModule = await import('node:readline');

const originalConsoleLog = console.log;
const originalHttpClientFromConfig = HttpClient.fromConfig;

describe('unit/cli/projects', () => {
  beforeEach(() => {
    logs.warn.length = 0;
    loadAuthTokenMock.mockClear();
    loadCliConfigMock.mockClear();
    clearCurrentProjectMock.mockClear();
    getCurrentProjectMock.mockClear();
    setCurrentProjectMock.mockClear();
    httpClientGetMock.mockClear();

    console.log = () => {};

    mock.module('../../../src/services/auth/token-manager', () => ({
      loadAuthToken: loadAuthTokenMock,
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
    mock.module('../../../src/services/auth/token-manager', () => ({ ...originalAuthModule }));
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
});
