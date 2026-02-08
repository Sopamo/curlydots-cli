import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readTgzEntries,
  readTgzPackageJson,
} from '../../../scripts/distribution/release-check.mjs';
import {
  buildMainPackageManifest,
  normalizePlatformMetadata,
  stageMainPackage,
} from '../../../scripts/distribution/stage-main-package.mjs';
import { PLATFORM_PACKAGE_NAMES } from '../../../scripts/distribution/targets.mjs';

describe('distribution/stage-main-package', () => {
  it('builds main package manifest with optionalDependencies for all platform packages', () => {
    const manifest = buildMainPackageManifest(
      {
        description: 'CurlyDots CLI',
        repository: { type: 'git', url: 'https://github.com/Sopamo/curlydots-cli' },
      },
      '1.4.0',
      PLATFORM_PACKAGE_NAMES.map((name) => ({ name })),
    );

    expect(manifest.name).toBe('@curlydots/cli');
    expect(manifest.bin.curlydots).toBe('bin/curlydots.exe');
    expect(manifest.scripts.postinstall).toBe('node install.cjs');
    expect(Object.keys(manifest.optionalDependencies).sort()).toEqual(
      [...PLATFORM_PACKAGE_NAMES].sort(),
    );
    for (const dependencyVersion of Object.values(manifest.optionalDependencies)) {
      expect(dependencyVersion).toBe('1.4.0');
    }
  });

  it('rejects platform metadata with missing package names', () => {
    expect(() =>
      normalizePlatformMetadata({
        packages: [{ name: '@curlydots/cli-linux-x64' }],
      }),
    ).toThrow('Invalid platform metadata');
  });

  it('stages main package tarball with binary placeholder and installer script', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'curlydots-stage-main-test-'));

    try {
      const outputDir = path.join(tempDir, 'npm');
      const stagingDir = path.join(tempDir, 'staging');
      const platformMetadataPath = path.join(tempDir, 'platform-metadata.json');
      writeFileSync(
        platformMetadataPath,
        JSON.stringify(
          {
            version: '5.6.7',
            packages: PLATFORM_PACKAGE_NAMES.map((name) => ({ name })),
          },
          null,
          2,
        ),
      );

      const metadata = stageMainPackage({
        version: '5.6.7',
        outputDir,
        packageRoot: process.cwd(),
        stagingDir,
        platformMetadataPath,
      });

      const entries = readTgzEntries(metadata.tarballPath);
      const manifest = readTgzPackageJson(metadata.tarballPath);

      expect(entries).toContain('package/bin/curlydots.exe');
      expect(entries).toContain('package/install.cjs');
      expect(manifest.name).toBe('@curlydots/cli');
      expect(manifest.version).toBe('5.6.7');
      expect(manifest.bin.curlydots).toBe('bin/curlydots.exe');
      expect(manifest.scripts.postinstall).toBe('node install.cjs');
      expect(Object.keys(manifest.optionalDependencies).sort()).toEqual(
        [...PLATFORM_PACKAGE_NAMES].sort(),
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
