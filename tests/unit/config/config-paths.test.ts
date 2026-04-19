import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

let moduleNonce = 0;
let mockedCwd = '/workspace';
const existingPaths = new Set<string>();
let mkdirSyncMock: ReturnType<typeof mock>;
let writeFileSyncMock: ReturnType<typeof mock>;

async function importFreshConfigPathsModule() {
  moduleNonce += 1;
  return import(`../../../src/config/config-paths.ts?test=${moduleNonce}`);
}

describe('config/config-paths', () => {
  const originalProcessCwd = process.cwd;

  beforeEach(() => {
    mockedCwd = '/workspace';
    existingPaths.clear();
    mkdirSyncMock = mock(() => undefined);
    writeFileSyncMock = mock(() => undefined);

    mock.module('../../../src/config/node-platform', () => ({
      platform: {
        homedir: () => '/home/test',
        existsSync: (filePath: string) => existingPaths.has(filePath),
        mkdirSync: mkdirSyncMock,
        readFileSync: () => '',
        writeFileSync: writeFileSyncMock,
      },
    }));

    process.cwd = (() => mockedCwd) as typeof process.cwd;
  });

  afterEach(() => {
    mock.restore();
    mock.clearAllMocks();
    process.cwd = originalProcessCwd;
  });

  it('does not search beyond the nearest git boundary', async () => {
    const repoDir = '/tmp/config-paths/repo';
    const nestedDir = join(repoDir, 'apps', 'web');
    const outsideConfigDir = '/tmp/config-paths/.curlydots';

    existingPaths.add(join(repoDir, '.git'));
    existingPaths.add(join(outsideConfigDir, 'config.json'));
    mockedCwd = nestedDir;

    const { findNearestProjectCurlydotsFilePath } = await importFreshConfigPathsModule();
    const result = findNearestProjectCurlydotsFilePath('config.json');
    expect(result).toBeUndefined();
  });

  it('resolves project config within the git boundary hierarchy', async () => {
    const repoDir = '/tmp/config-paths/repo';
    const nestedDir = join(repoDir, 'apps', 'web');
    const repoConfigDir = join(repoDir, '.curlydots');

    existingPaths.add(join(repoDir, '.git'));
    existingPaths.add(join(repoConfigDir, 'config.json'));
    mockedCwd = nestedDir;

    const { findNearestProjectCurlydotsFilePath } = await importFreshConfigPathsModule();
    const result = findNearestProjectCurlydotsFilePath('config.json');
    expect(result).toBe(join(repoConfigDir, 'config.json'));
  });

  it('does not walk parent directories when no git boundary exists', async () => {
    const workspaceDir = '/tmp/config-paths/workspace';
    const nestedDir = join(workspaceDir, 'child');
    const workspaceConfigDir = join(workspaceDir, '.curlydots');

    existingPaths.add(join(workspaceConfigDir, 'config.json'));
    mockedCwd = nestedDir;

    const { findNearestProjectCurlydotsFilePath } = await importFreshConfigPathsModule();
    const result = findNearestProjectCurlydotsFilePath('config.json');
    expect(result).toBeUndefined();
  });

  it('can search upward from an explicit base directory without a git boundary', async () => {
    const workspaceDir = '/tmp/config-paths/workspace';
    const nestedDir = join(workspaceDir, 'apps', 'web', 'translations');
    const workspaceConfigDir = join(workspaceDir, '.curlydots');

    existingPaths.add(join(workspaceConfigDir, 'config.json'));

    const { findNearestCurlydotsFilePathFrom } = await importFreshConfigPathsModule();
    const result = findNearestCurlydotsFilePathFrom('config.json', nestedDir);
    expect(result).toBe(join(workspaceConfigDir, 'config.json'));
  });

  it('computes the common ancestor directory for translation paths', async () => {
    const { findCommonAncestorDirectory } = await importFreshConfigPathsModule();

    const result = findCommonAncestorDirectory([
      '/home/user/me/projects/project-1/modules/app/translations',
      '/home/user/me/projects/project-1/modules/users/translations',
      '/home/user/me/projects/project-1/lang/translations',
    ]);

    expect(result).toBe('/home/user/me/projects/project-1');
  });

  it('widens the common ancestor when translation paths span multiple projects', async () => {
    const { findCommonAncestorDirectory } = await importFreshConfigPathsModule();

    const result = findCommonAncestorDirectory([
      '/home/user/me/projects/project-1/modules/app/translations',
      '/home/user/me/projects/project-1/modules/users/translations',
      '/home/user/me/projects/project-1/lang/translations',
      '/home/user/me/projects/project-2/translations',
    ]);

    expect(result).toBe('/home/user/me/projects');
  });

  it('creates global config and auth templates with frontendUrl when missing', async () => {
    const { ensureGlobalCurlydotsConfigFiles } = await importFreshConfigPathsModule();

    ensureGlobalCurlydotsConfigFiles();

    expect(mkdirSyncMock).toHaveBeenCalledWith('/home/test/.curlydots', { recursive: true });
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      '/home/test/.curlydots/config.json',
      `${JSON.stringify(
        {
          schemaVersion: 1,
          apiEndpoint: 'https://curlydots.com/api',
          frontendUrl: 'https://curlydots.com',
          debug: false,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      '/home/test/.curlydots/auth.json',
      `${JSON.stringify(
        {
          schemaVersion: 1,
          authMethod: 'browser',
          tokenStorage: 'keychain',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  });
});
