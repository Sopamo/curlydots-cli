import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findNearestProjectCurlydotsFilePath } from '../../../src/config/config-paths';

describe('config/config-paths', () => {
  const originalCwd = process.cwd();
  const createdDirs: string[] = [];

  beforeEach(() => {
    process.chdir(originalCwd);
    createdDirs.length = 0;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    for (const dir of createdDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not search beyond the nearest git boundary', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'curlydots-config-paths-'));
    createdDirs.push(sandbox);

    const repoDir = join(sandbox, 'repo');
    const nestedDir = join(repoDir, 'apps', 'web');
    const outsideConfigDir = join(sandbox, '.curlydots');

    mkdirSync(nestedDir, { recursive: true });
    mkdirSync(outsideConfigDir, { recursive: true });
    writeFileSync(join(repoDir, '.git'), 'gitdir');
    writeFileSync(join(outsideConfigDir, 'config.json'), '{}');

    process.chdir(nestedDir);

    const result = findNearestProjectCurlydotsFilePath('config.json');
    expect(result).toBeUndefined();
  });

  it('resolves project config within the git boundary hierarchy', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'curlydots-config-paths-'));
    createdDirs.push(sandbox);

    const repoDir = join(sandbox, 'repo');
    const nestedDir = join(repoDir, 'apps', 'web');
    const repoConfigDir = join(repoDir, '.curlydots');

    mkdirSync(nestedDir, { recursive: true });
    mkdirSync(repoConfigDir, { recursive: true });
    writeFileSync(join(repoDir, '.git'), 'gitdir');
    writeFileSync(join(repoConfigDir, 'config.json'), '{}');

    process.chdir(nestedDir);

    const result = findNearestProjectCurlydotsFilePath('config.json');
    expect(result).toBe(join(repoConfigDir, 'config.json'));
  });

  it('does not walk parent directories when no git boundary exists', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'curlydots-config-paths-'));
    createdDirs.push(sandbox);

    const workspaceDir = join(sandbox, 'workspace');
    const nestedDir = join(workspaceDir, 'child');
    const workspaceConfigDir = join(workspaceDir, '.curlydots');

    mkdirSync(nestedDir, { recursive: true });
    mkdirSync(workspaceConfigDir, { recursive: true });
    writeFileSync(join(workspaceConfigDir, 'config.json'), '{}');

    process.chdir(nestedDir);

    const result = findNearestProjectCurlydotsFilePath('config.json');
    expect(result).toBeUndefined();
  });
});
