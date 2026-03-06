import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

let moduleNonce = 0;
let mockedCwd = '/workspace';
const existingPaths = new Set<string>();

async function importFreshConfigPathsModule() {
  moduleNonce += 1;
  return import(`../../../src/config/config-paths.ts?test=${moduleNonce}`);
}

describe('config/config-paths', () => {
  const originalProcessCwd = process.cwd;

  beforeEach(() => {
    mockedCwd = '/workspace';
    existingPaths.clear();

    mock.module('node:fs', () => ({
      existsSync: (filePath: string) => existingPaths.has(filePath),
      mkdirSync: () => undefined,
      readFileSync: () => '',
      writeFileSync: () => undefined,
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
});
