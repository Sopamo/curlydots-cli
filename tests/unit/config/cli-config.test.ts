import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

const ORIGINAL_ENV = { ...process.env };
let moduleNonce = 0;

function mockConfigPathsModule(options: {
  globalConfigPath?: string;
  projectConfigPath?: string;
  globalAuthPath?: string;
  readFileSyncMock: (filePath: string) => string;
  existsSyncMock: (filePath: string) => boolean;
  mkdirSyncMock?: (...args: unknown[]) => unknown;
  writeFileSyncMock?: (...args: unknown[]) => unknown;
}) {
  const {
    globalConfigPath = '/home/test/.curlydots/config.json',
    projectConfigPath,
    globalAuthPath = '/home/test/.curlydots/auth.json',
    readFileSyncMock,
    existsSyncMock,
    mkdirSyncMock = () => undefined,
    writeFileSyncMock = () => undefined,
  } = options;

  mock.module('../../../src/config/config-paths', () => ({
    ensureGlobalCurlydotsConfigFiles: () => {
      if (!existsSyncMock(globalConfigPath)) {
        mkdirSyncMock('/home/test/.curlydots', { recursive: true });
        writeFileSyncMock(globalConfigPath, `${JSON.stringify({ schemaVersion: 1, apiEndpoint: 'https://curlydots.com/api', frontendUrl: 'https://curlydots.com', debug: false }, null, 2)}\n`, 'utf8');
      }
      if (!existsSyncMock(globalAuthPath)) {
        mkdirSyncMock('/home/test/.curlydots', { recursive: true });
        writeFileSyncMock(globalAuthPath, `${JSON.stringify({ schemaVersion: 1, authMethod: 'browser', tokenStorage: 'keychain' }, null, 2)}\n`, 'utf8');
      }
    },
    findNearestProjectCurlydotsFilePath: (fileName: string) => {
      if (fileName !== 'config.json') {
        return undefined;
      }

      if (projectConfigPath && existsSyncMock(projectConfigPath)) {
        return projectConfigPath;
      }

      return undefined;
    },
    findNearestCurlydotsFilePathFrom: (fileName: string, startDir: string) => {
      if (fileName !== 'config.json' || !projectConfigPath) {
        return undefined;
      }

      return projectConfigPath.startsWith(`${startDir}/`) || projectConfigPath === `${startDir}/.curlydots/config.json`
        ? projectConfigPath
        : undefined;
    },
    getGlobalCurlydotsFilePath: (fileName: string) => `/home/test/.curlydots/${fileName}`,
    parseJsonObjectFile: (filePath: string) => {
      if (!existsSyncMock(filePath)) {
        return {};
      }

      return JSON.parse(readFileSyncMock(filePath)) as Record<string, unknown>;
    },
    readSchemaVersion: (rawConfig: Record<string, unknown>) => typeof rawConfig.schemaVersion === 'number' ? rawConfig.schemaVersion : 0,
    writeJsonObjectFile: (filePath: string, value: Record<string, unknown>) => {
      mkdirSyncMock('/home/test/.curlydots', { recursive: true });
      writeFileSyncMock(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    },
  }));
}

function importFreshCliConfigModule() {
  moduleNonce += 1;
  return import(`../../../src/config/cli-config.ts?test=${moduleNonce}`);
}

describe('config/cli-config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    mock.clearAllMocks();
    mock.restore();
  });

  it('creates global config and auth templates on first load when missing', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const configDir = '/home/test/.curlydots';

    const existsSyncMock = mock(() => false);
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://curlydots.com/api',
          debug: false,
        });
      }
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });
    const mkdirSyncMock = mock(() => undefined);
    const writeFileSyncMock = mock(() => undefined);

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
      mkdirSyncMock,
      writeFileSyncMock,
    });

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://curlydots.com/api');
    expect(config.frontendUrl).toBe('https://curlydots.com');
    expect(config.debug).toBe(false);
    expect(config.timeout).toBe(30_000);
    expect(config.retries).toBe(3);

    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalConfigPath,
      `${JSON.stringify({ schemaVersion: 1, apiEndpoint: 'https://curlydots.com/api', frontendUrl: 'https://curlydots.com', debug: false }, null, 2)}\n`,
      'utf8',
    );
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalAuthPath,
      `${JSON.stringify({ schemaVersion: 1, authMethod: 'browser', tokenStorage: 'keychain' }, null, 2)}\n`,
      'utf8',
    );
    expect(mkdirSyncMock).toHaveBeenCalledWith(configDir, { recursive: true });
  });

  it('merges global and project config for supported keys only', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const projectConfigPath = join(process.cwd(), '.curlydots/config.json');

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath
      || filePath === globalAuthPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-global.example/api',
          frontendUrl: 'https://frontend-global.example',
          defaultLocale: 'en',
          timeout: 45_000,
          retries: 4,
          debug: false,
        });
      }
      if (filePath === projectConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          defaultLocale: 'de',
          timeout: 15_000,
          debug: true,
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      projectConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
    });

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://from-global.example/api');
    expect(config.frontendUrl).toBe('https://frontend-global.example');
    expect(config.defaultLocale).toBe('en');
    expect(config.timeout).toBe(30_000);
    expect(config.retries).toBe(3);
    expect(config.debug).toBe(false);
    expect(config.sources.apiEndpoint).toEqual({ source: 'global', path: globalConfigPath });
    expect(config.sources.frontendUrl).toEqual({ source: 'global', path: globalConfigPath });
    expect(config.sources.debug).toEqual({ source: 'global', path: globalConfigPath });
  });

  it('lets project config override merged global config values', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const projectConfigPath = join(process.cwd(), '.curlydots/config.json');

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath
      || filePath === globalAuthPath
      || filePath === projectConfigPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-config.example/api',
          frontendUrl: 'https://frontend-config.example',
          retries: 9,
          debug: false,
        });
      }
      if (filePath === projectConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-project.example/api',
          frontendUrl: 'https://frontend-project.example',
          timeout: 5_000,
          debug: false,
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      projectConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
    });

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://from-project.example/api');
    expect(config.frontendUrl).toBe('https://frontend-project.example');
    expect(config.debug).toBe(false);
    expect(config.timeout).toBe(30_000);
    expect(config.retries).toBe(3);
    expect(config.sources.apiEndpoint).toEqual({ source: 'project', path: projectConfigPath });
    expect(config.sources.frontendUrl).toEqual({ source: 'project', path: projectConfigPath });
    expect(config.sources.debug).toEqual({ source: 'project', path: projectConfigPath });
  });

  it('uses the explicit base directory to find project config overrides', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const explicitBaseDir = '/workspace/shared';
    const projectConfigPath = join(explicitBaseDir, '.curlydots/config.json');

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath
      || filePath === globalAuthPath
      || filePath === projectConfigPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-global.example/api',
          frontendUrl: 'https://frontend-global.example',
          debug: false,
        });
      }
      if (filePath === projectConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-explicit.example/api',
          frontendUrl: 'https://frontend-explicit.example',
          debug: true,
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      projectConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
    });

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig(explicitBaseDir);

    expect(config.apiEndpoint).toBe('https://from-explicit.example/api');
    expect(config.frontendUrl).toBe('https://frontend-explicit.example');
    expect(config.debug).toBe(true);
    expect(config.sources.apiEndpoint).toEqual({ source: 'project', path: projectConfigPath });
  });

  it('reports project and global config sources for resolved values', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const projectConfigPath = join(process.cwd(), '.curlydots/config.json');

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath
      || filePath === globalAuthPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-global.example/api',
          frontendUrl: 'https://frontend-global.example',
          debug: true,
        });
      }
      if (filePath === projectConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-project.example/api',
          frontendUrl: 'https://frontend-project.example',
        });
      }
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      projectConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
    });

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://from-global.example/api');
    expect(config.frontendUrl).toBe('https://frontend-global.example');
    expect(config.debug).toBe(true);
    expect(config.sources.apiEndpoint).toEqual({ source: 'global', path: globalConfigPath });
    expect(config.sources.frontendUrl).toEqual({ source: 'global', path: globalConfigPath });
    expect(config.sources.debug).toEqual({ source: 'global', path: globalConfigPath });
  });

  it('reports default sources when no config file overrides are present', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';

    const existsSyncMock = mock((filePath: string) => filePath === globalConfigPath || filePath === globalAuthPath);
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({ schemaVersion: 1 });
      }
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
    });

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://curlydots.com/api');
    expect(config.frontendUrl).toBe('https://curlydots.com');
    expect(config.debug).toBe(false);
    expect(config.sources.apiEndpoint).toEqual({ source: 'global', path: globalConfigPath });
    expect(config.sources.frontendUrl).toEqual({ source: 'global', path: globalConfigPath });
    expect(config.sources.debug).toEqual({ source: 'global', path: globalConfigPath });
  });

  it('warns when config schema version is newer than supported', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const warnSpy = mock(() => undefined);

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath || filePath === globalAuthPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 99,
          apiEndpoint: 'https://from-global.example/api',
          frontendUrl: 'https://frontend-global.example',
          debug: true,
        });
      }
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
    });

    const originalWarn = console.warn;
    console.warn = warnSpy as unknown as typeof console.warn;

    try {
      const { loadCliConfig } = await importFreshCliConfigModule();
      const config = loadCliConfig();

      expect(config.apiEndpoint).toBe('https://from-global.example/api');
      expect(config.frontendUrl).toBe('https://frontend-global.example');
      expect(config.debug).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('migrates legacy config without schemaVersion to the current version', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const writeFileSyncMock = mock(() => undefined);
    const mkdirSyncMock = mock(() => undefined);

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath || filePath === globalAuthPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          apiEndpoint: 'https://legacy.example/api',
          frontendUrl: 'https://frontend-legacy.example',
          debug: true,
        });
      }
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
      mkdirSyncMock,
      writeFileSyncMock,
    });

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://legacy.example/api');
    expect(config.frontendUrl).toBe('https://frontend-legacy.example');
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalConfigPath,
      `${JSON.stringify({ schemaVersion: 1, apiEndpoint: 'https://legacy.example/api', frontendUrl: 'https://frontend-legacy.example', debug: true }, null, 2)}\n`,
      'utf8',
    );
  });

  it('auto-heals supported schema config by removing deprecated keys', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const writeFileSyncMock = mock(() => undefined);
    const mkdirSyncMock = mock(() => undefined);

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath || filePath === globalAuthPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://heal.example/api',
          frontendUrl: 'https://frontend-heal.example',
          debug: true,
          timeout: 1,
          retries: 999,
          token: 'deprecated',
        });
      }
      if (filePath === globalAuthPath) {
        return JSON.stringify({
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mockConfigPathsModule({
      globalConfigPath,
      globalAuthPath,
      readFileSyncMock,
      existsSyncMock,
      mkdirSyncMock,
      writeFileSyncMock,
    });

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://heal.example/api');
    expect(config.frontendUrl).toBe('https://frontend-heal.example');
    expect(config.timeout).toBe(30_000);
    expect(config.retries).toBe(3);
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalConfigPath,
      `${JSON.stringify({ schemaVersion: 1, apiEndpoint: 'https://heal.example/api', frontendUrl: 'https://frontend-heal.example', debug: true }, null, 2)}\n`,
      'utf8',
    );
  });
});
