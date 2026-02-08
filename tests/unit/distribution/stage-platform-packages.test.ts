import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readTgzEntries,
  readTgzPackageJson,
} from '../../../scripts/distribution/release-check.mjs';
import {
  buildPlatformPackageManifest,
  stagePlatformPackages,
} from '../../../scripts/distribution/stage-platform-packages.mjs';
import { PLATFORM_PACKAGE_TARGETS } from '../../../scripts/distribution/targets.mjs';

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`,
    );
  }
}

function createArtifact(
  target: (typeof PLATFORM_PACKAGE_TARGETS)[number],
  artifactPath: string,
  tempDir: string,
) {
  const binaryDir = path.join(tempDir, target.targetTriple);
  const binaryPath = path.join(binaryDir, target.binaryName);
  mkdirSync(binaryDir, { recursive: true });
  writeFileSync(binaryPath, `binary-${target.targetTriple}`);

  if (artifactPath.endsWith('.tar.gz')) {
    run('tar', ['-czf', artifactPath, '-C', binaryDir, target.binaryName]);
    return;
  }

  if (artifactPath.endsWith('.zip')) {
    run('zip', ['-j', artifactPath, binaryPath]);
    return;
  }

  throw new Error(`Unexpected artifact extension: ${artifactPath}`);
}

describe('distribution/stage-platform-packages', () => {
  it('builds platform package manifests with os/cpu constraints', () => {
    const manifest = buildPlatformPackageManifest(
      {
        description: 'CurlyDots CLI',
        repository: { type: 'git', url: 'https://github.com/Sopamo/curlydots-cli' },
      },
      PLATFORM_PACKAGE_TARGETS[0],
      '1.2.3',
    );

    expect(manifest.name).toBe('@curlydots/cli-linux-x64');
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.os).toEqual(['linux']);
    expect(manifest.cpu).toEqual(['x64']);
    expect(manifest.publishConfig?.access).toBe('public');
  });

  it('stages five platform tarballs with a single native binary each', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'curlydots-stage-platform-test-'));

    try {
      const artifactsDir = path.join(tempDir, 'artifacts');
      const outputDir = path.join(tempDir, 'npm');
      const stagingDir = path.join(tempDir, 'staging');
      mkdirSync(artifactsDir, { recursive: true });

      for (const target of PLATFORM_PACKAGE_TARGETS) {
        createArtifact(target, path.join(artifactsDir, target.artifact), tempDir);
      }

      const metadata = stagePlatformPackages({
        version: '9.9.9',
        artifactsDir,
        outputDir,
        packageRoot: process.cwd(),
        stagingDir,
      });

      expect(metadata.version).toBe('9.9.9');
      expect(metadata.packages).toHaveLength(5);

      for (const entry of metadata.packages) {
        expect(existsSync(entry.tarballPath)).toBe(true);
      }

      const linuxX64 = metadata.packages.find((entry) => entry.name === '@curlydots/cli-linux-x64');
      expect(linuxX64).toBeDefined();
      if (!linuxX64) {
        throw new Error('Expected linux-x64 package in metadata');
      }

      const linuxManifest = readTgzPackageJson(linuxX64.tarballPath);
      const linuxEntries = readTgzEntries(linuxX64.tarballPath);
      expect(linuxManifest.name).toBe('@curlydots/cli-linux-x64');
      expect(linuxManifest.os).toEqual(['linux']);
      expect(linuxManifest.cpu).toEqual(['x64']);
      expect(linuxEntries).toContain('package/bin/curlydots');

      const windowsX64 = metadata.packages.find(
        (entry) => entry.name === '@curlydots/cli-win32-x64',
      );
      expect(windowsX64).toBeDefined();
      if (!windowsX64) {
        throw new Error('Expected win32-x64 package in metadata');
      }

      const windowsEntries = readTgzEntries(windowsX64.tarballPath);
      expect(windowsEntries).toContain('package/bin/curlydots.exe');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
