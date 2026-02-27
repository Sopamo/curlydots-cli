import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

const ORIGINAL_ENV = { ...process.env };
let moduleNonce = 0;

function importFreshCliConfigModule() {
  moduleNonce += 1;
  return import(`../../../src/config/cli-config.ts?test=${moduleNonce}`);
}

describe('config/cli-config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CURLYDOTS_API_URL;
    delete process.env.CURLYDOTS_DEBUG;
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

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
      mkdirSync: mkdirSyncMock,
      writeFileSync: writeFileSyncMock,
    }));

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://curlydots.com/api');
    expect(config.debug).toBe(false);
    expect(config.timeout).toBe(30_000);
    expect(config.retries).toBe(3);

    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalConfigPath,
      `${JSON.stringify({ schemaVersion: 1, apiEndpoint: 'https://curlydots.com/api', debug: false }, null, 2)}\n`,
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
      || filePath === projectConfigPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-global.example/api',
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

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
    }));

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://from-global.example/api');
    expect(config.defaultLocale).toBe('de');
    expect(config.timeout).toBe(30_000);
    expect(config.retries).toBe(3);
    expect(config.debug).toBe(true);
  });

  it('lets environment variables override merged config values', async () => {
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
          retries: 9,
          debug: false,
        });
      }
      if (filePath === projectConfigPath) {
        return JSON.stringify({
          schemaVersion: 1,
          apiEndpoint: 'https://from-project.example/api',
          timeout: 5_000,
          debug: false,
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
    }));

    process.env.CURLYDOTS_API_URL = 'https://from-env.example/api';
    process.env.CURLYDOTS_DEBUG = 'true';

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://from-env.example/api');
    expect(config.debug).toBe(true);
    expect(config.timeout).toBe(30_000);
    expect(config.retries).toBe(3);
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

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
    }));

    const originalWarn = console.warn;
    console.warn = warnSpy as unknown as typeof console.warn;

    try {
      const { loadCliConfig } = await importFreshCliConfigModule();
      const config = loadCliConfig();

      expect(config.apiEndpoint).toBe('https://from-global.example/api');
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

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
      writeFileSync: writeFileSyncMock,
      mkdirSync: mkdirSyncMock,
    }));

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://legacy.example/api');
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalConfigPath,
      `${JSON.stringify({ apiEndpoint: 'https://legacy.example/api', debug: true, schemaVersion: 1 }, null, 2)}\n`,
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

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
      writeFileSync: writeFileSyncMock,
      mkdirSync: mkdirSyncMock,
    }));

    const { loadCliConfig } = await importFreshCliConfigModule();
    const config = loadCliConfig();

    expect(config.apiEndpoint).toBe('https://heal.example/api');
    expect(config.timeout).toBe(30_000);
    expect(config.retries).toBe(3);
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalConfigPath,
      `${JSON.stringify({ schemaVersion: 1, apiEndpoint: 'https://heal.example/api', debug: true }, null, 2)}\n`,
      'utf8',
    );
  });
});
