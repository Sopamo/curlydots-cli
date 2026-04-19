import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { dirname } from 'node:path';

const PROJECT_AUTH_PATH = '/workspace/project/.curlydots/auth.json';

const ORIGINAL_ENV = { ...process.env };
let moduleNonce = 0;

function importFreshAuthConfigModule() {
  moduleNonce += 1;
  return import(`../../../src/config/auth-config.ts?test=${moduleNonce}`);
}

function mockConfigPathsModule(options: {
  globalAuthPath?: string;
  projectAuthPath?: string;
  readFileSyncMock: (filePath: string) => string;
  mkdirSyncMock?: (...args: unknown[]) => unknown;
  writeFileSyncMock?: (...args: unknown[]) => unknown;
}) {
  const {
    globalAuthPath = '/home/test/.curlydots/auth.json',
    projectAuthPath,
    readFileSyncMock,
    mkdirSyncMock = () => undefined,
    writeFileSyncMock = () => undefined,
  } = options;

  mock.module('../../../src/config/config-paths', () => ({
    ensureGlobalCurlydotsConfigFiles: () => undefined,
    findNearestProjectCurlydotsFilePath: (fileName: string) =>
      fileName === 'auth.json' ? projectAuthPath : undefined,
    findNearestCurlydotsFilePathFrom: (fileName: string, startDir: string) => {
      if (fileName !== 'auth.json' || !projectAuthPath) {
        return undefined;
      }

      return projectAuthPath.startsWith(`${startDir}/`) ||
        projectAuthPath === `${startDir}/.curlydots/auth.json`
        ? projectAuthPath
        : undefined;
    },
    getGlobalCurlydotsFilePath: (fileName: string) =>
      fileName === 'auth.json' ? globalAuthPath : `/home/test/.curlydots/${fileName}`,
    parseJsonObjectFile: (filePath: string) =>
      JSON.parse(readFileSyncMock(filePath)) as Record<string, unknown>,
    readSchemaVersion: (rawConfig: Record<string, unknown>) =>
      typeof rawConfig.schemaVersion === 'number' ? rawConfig.schemaVersion : 0,
    writeJsonObjectFile: (filePath: string, value: Record<string, unknown>) => {
      mkdirSyncMock(dirname(filePath), { recursive: true });
      writeFileSyncMock(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    },
  }));
}

describe('config/auth-config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.CURLYDOTS_TOKEN = undefined;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    mock.clearAllMocks();
    mock.restore();
  });

  it('merges global and project auth config, with project values taking precedence', async () => {
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const projectAuthPath = PROJECT_AUTH_PATH;

    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'api_key',
          tokenStorage: 'keychain',
          token: 'global-token',
        });
      }
      if (filePath === projectAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'api_key',
          tokenStorage: 'file',
          token: 'project-token',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mockConfigPathsModule({
      globalAuthPath,
      projectAuthPath,
      readFileSyncMock,
      mkdirSyncMock: () => undefined,
      writeFileSyncMock: () => undefined,
    });

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig();

    expect(config.authMethod).toBe('api_key');
    expect(config.tokenStorage).toBe('file');
    expect(config.token).toBe('project-token');
  });

  it('lets environment variable token override merged auth config', async () => {
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const projectAuthPath = PROJECT_AUTH_PATH;

    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
          token: 'global-token',
        });
      }
      if (filePath === projectAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          token: 'project-token',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mockConfigPathsModule({
      globalAuthPath,
      projectAuthPath,
      readFileSyncMock,
    });

    process.env.CURLYDOTS_TOKEN = 'env-token';

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig();

    expect(config.token).toBe('env-token');
    expect(config.tokenStorage).toBe('keychain');
  });

  it('uses the explicit base directory to find project auth overrides', async () => {
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const explicitBaseDir = '/workspace/shared';
    const projectAuthPath = `${explicitBaseDir}/.curlydots/auth.json`;

    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
          token: 'global-token',
        });
      }
      if (filePath === projectAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'api_key',
          tokenStorage: 'file',
          token: 'explicit-token',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mockConfigPathsModule({
      globalAuthPath,
      projectAuthPath,
      readFileSyncMock,
    });

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig(explicitBaseDir);

    expect(config.authMethod).toBe('api_key');
    expect(config.tokenStorage).toBe('file');
    expect(config.token).toBe('explicit-token');
  });

  it('warns when auth schema version is newer than supported', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const warnSpy = mock(() => undefined);

    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 99,
          authMethod: 'api_key',
          tokenStorage: 'file',
          token: 'global-token',
        });
      }
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://curlydots.com/api',
          debug: false,
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mockConfigPathsModule({
      globalAuthPath,
      readFileSyncMock,
    });

    const originalWarn = console.warn;
    console.warn = warnSpy as unknown as typeof console.warn;

    try {
      const { loadCliAuthConfig } = await importFreshAuthConfigModule();
      const config = loadCliAuthConfig();

      expect(config.token).toBe('global-token');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('migrates legacy auth config without schemaVersion to the current version', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const writeFileSyncMock = mock(() => undefined);
    const mkdirSyncMock = mock(() => undefined);

    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          token: 'legacy-token',
          tokenStorage: 'file',
        });
      }
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://curlydots.com/api',
          debug: false,
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mockConfigPathsModule({
      globalAuthPath,
      readFileSyncMock,
      mkdirSyncMock,
      writeFileSyncMock,
    });

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig();

    expect(config.token).toBe('legacy-token');
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalAuthPath,
      `${JSON.stringify({ schemaVersion: 1, authMethod: 'browser', tokenStorage: 'file', token: 'legacy-token' }, null, 2)}\n`,
      'utf8',
    );
  });

  it('auto-heals supported schema auth config by adding/removing keys', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const writeFileSyncMock = mock(() => undefined);
    const mkdirSyncMock = mock(() => undefined);

    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'api_key',
          tokenStorage: 'legacy-invalid',
          token: 't',
          apiEndpoint: 'deprecated',
        });
      }
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://curlydots.com/api',
          debug: false,
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mockConfigPathsModule({
      globalAuthPath,
      readFileSyncMock,
      mkdirSyncMock,
      writeFileSyncMock,
    });

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig();

    expect(config.authMethod).toBe('api_key');
    expect(config.tokenStorage).toBe('keychain');
    expect(config.token).toBe('t');
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalAuthPath,
      `${JSON.stringify({ schemaVersion: 1, authMethod: 'api_key', tokenStorage: 'keychain', token: 't' }, null, 2)}\n`,
      'utf8',
    );
  });

  it('ignores config-like fields in auth.json so auth config never affects runtime config', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const writeFileSyncMock = mock(() => undefined);
    const mkdirSyncMock = mock(() => undefined);

    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'file',
          token: 'auth-token',
          apiEndpoint: 'http://localhost/api',
          debug: true,
          defaultLocale: 'nl',
        });
      }
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://curlydots.com/api',
          debug: false,
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mockConfigPathsModule({
      globalAuthPath,
      readFileSyncMock,
      mkdirSyncMock,
      writeFileSyncMock,
    });

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig();

    expect(config.authMethod).toBe('browser');
    expect(config.tokenStorage).toBe('file');
    expect(config.token).toBe('auth-token');
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalAuthPath,
      `${JSON.stringify({ schemaVersion: 1, authMethod: 'browser', tokenStorage: 'file', token: 'auth-token' }, null, 2)}\n`,
      'utf8',
    );
  });
});
