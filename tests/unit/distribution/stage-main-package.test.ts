import { describe, expect, it } from 'bun:test';
import * as os from 'node:os';
import path from 'node:path';

import { PLATFORM_PACKAGE_NAMES } from '../../../scripts/distribution/targets.mjs';

const CLI_ROOT = path.resolve(import.meta.dir, '../../..');
let moduleNonce = 0;

async function loadStageMainPackageModule() {
  moduleNonce += 1;
  return import(`../../../scripts/distribution/stage-main-package.mjs?test=${moduleNonce}`);
}

async function loadReleaseCheckModule() {
  moduleNonce += 1;
  return import(`../../../scripts/distribution/release-check.mjs?test=${moduleNonce}`);
}

describe('distribution/stage-main-package', () => {
  it('builds main package manifest with optionalDependencies for all platform packages', async () => {
    const { buildMainPackageManifest } = await loadStageMainPackageModule();
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

  it('rejects platform metadata with missing package names', async () => {
    const { normalizePlatformMetadata } = await loadStageMainPackageModule();
    expect(() =>
      normalizePlatformMetadata({
        packages: [{ name: '@curlydots/cli-linux-x64' }],
      }),
    ).toThrow('Invalid platform metadata');
  });

  it('stages main package tarball with binary placeholder and installer script', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { readTgzEntries, readTgzPackageJson } = await loadReleaseCheckModule();
    const { stageMainPackage } = await loadStageMainPackageModule();
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
        packageRoot: CLI_ROOT,
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
