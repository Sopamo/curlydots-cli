import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

const ORIGINAL_ENV = { ...process.env };
let moduleNonce = 0;

function importFreshAuthConfigModule() {
  moduleNonce += 1;
  return import(`../../../src/config/auth-config.ts?test=${moduleNonce}`);
}

describe('config/auth-config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CURLYDOTS_TOKEN;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    mock.clearAllMocks();
    mock.restore();
  });

  it('merges global and project auth config, with project values taking precedence', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const projectAuthPath = join(process.cwd(), '.curlydots/auth.json');

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath
      || filePath === globalAuthPath
      || filePath === projectAuthPath
    ));
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
          tokenStorage: 'file',
          token: 'project-token',
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

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig();

    expect(config.authMethod).toBe('api_key');
    expect(config.tokenStorage).toBe('file');
    expect(config.token).toBe('project-token');
  });

  it('lets environment variable token override merged auth config', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const projectAuthPath = join(process.cwd(), '.curlydots/auth.json');

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath
      || filePath === globalAuthPath
      || filePath === projectAuthPath
    ));
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

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
    }));

    process.env.CURLYDOTS_TOKEN = 'env-token';

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig();

    expect(config.token).toBe('env-token');
    expect(config.tokenStorage).toBe('keychain');
  });

  it('warns when auth schema version is newer than supported', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const warnSpy = mock(() => undefined);

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath || filePath === globalAuthPath
    ));
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

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath || filePath === globalAuthPath
    ));
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

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
      writeFileSync: writeFileSyncMock,
      mkdirSync: mkdirSyncMock,
    }));

    const { loadCliAuthConfig } = await importFreshAuthConfigModule();
    const config = loadCliAuthConfig();

    expect(config.token).toBe('legacy-token');
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalAuthPath,
      `${JSON.stringify({ token: 'legacy-token', tokenStorage: 'file', schemaVersion: 1 }, null, 2)}\n`,
      'utf8',
    );
  });

  it('auto-heals supported schema auth config by adding/removing keys', async () => {
    const globalConfigPath = '/home/test/.curlydots/config.json';
    const globalAuthPath = '/home/test/.curlydots/auth.json';
    const writeFileSyncMock = mock(() => undefined);
    const mkdirSyncMock = mock(() => undefined);

    const existsSyncMock = mock((filePath: string) => (
      filePath === globalConfigPath || filePath === globalAuthPath
    ));
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

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
      writeFileSync: writeFileSyncMock,
      mkdirSync: mkdirSyncMock,
    }));

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
});
