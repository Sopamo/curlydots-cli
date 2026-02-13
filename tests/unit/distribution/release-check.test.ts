import { describe, expect, it } from 'bun:test';

import {
  REQUIRED_RELEASE_ARCHIVES,
  TARBALL_SIZE_BUDGET_BYTES,
  validateMainManifest,
  validateMainTarballEntries,
  validatePlatformManifest,
  validatePlatformTarballEntries,
  validateReleaseArtifactSet,
  validateSha256SumsContent,
  validateTarballSizeBudget,
} from '../../../scripts/distribution/release-check.mjs';
import {
  PLATFORM_PACKAGE_NAMES,
  PLATFORM_PACKAGE_TARGETS,
} from '../../../scripts/distribution/targets.mjs';

describe('distribution/release-check', () => {
  it('reports missing release artifacts', () => {
    const files = [
      'curlydots-x86_64-unknown-linux-musl.tar.gz',
      'curlydots-x86_64-unknown-linux-musl.tar.gz.sha256',
      'SHA256SUMS',
    ];

    const result = validateReleaseArtifactSet(files);

    expect(result.isValid).toBe(false);
    expect(result.missing).toContain('curlydots-aarch64-unknown-linux-musl.tar.gz');
  });

  it('detects wrong artifact naming by treating expected names as missing', () => {
    const wrongWindowsName = 'curlydots-x86_64-pc-windows-msvc.tar.gz';
    const files = REQUIRED_RELEASE_ARCHIVES.map((name) => `${name}`).filter(
      (name) => name !== 'curlydots-x86_64-pc-windows-msvc.zip',
    );

    files.push(wrongWindowsName);
    files.push('SHA256SUMS');
    for (const file of files.filter((name) => name !== 'SHA256SUMS')) {
      files.push(`${file}.sha256`);
    }

    const result = validateReleaseArtifactSet(files);

    expect(result.isValid).toBe(false);
    expect(result.missing).toContain('curlydots-x86_64-pc-windows-msvc.zip');
  });

  it('accepts the complete release artifact set', () => {
    const files = [...REQUIRED_RELEASE_ARCHIVES, 'SHA256SUMS'];
    for (const artifact of REQUIRED_RELEASE_ARCHIVES) {
      files.push(`${artifact}.sha256`);
    }

    const result = validateReleaseArtifactSet(files);

    expect(result).toEqual({
      missing: [],
      missingChecksums: [],
      hasShaSumsFile: true,
      isValid: true,
    });
  });

  it('validates SHA256SUMS content and detects malformed lines', () => {
    const hash = 'a'.repeat(64);
    const validContent = REQUIRED_RELEASE_ARCHIVES.map((name) => `${hash}  ${name}`).join('\n');
    const valid = validateSha256SumsContent(validContent);

    expect(valid.valid).toBe(true);

    const invalid = validateSha256SumsContent('not-a-checksum-line');
    expect(invalid.valid).toBe(false);
    expect(invalid.malformedLine).toBe('not-a-checksum-line');
  });

  it('checks main npm tarball contents for binary placeholder and install script', () => {
    const invalidMain = validateMainTarballEntries(['package/bin/curlydots.exe']);
    expect(invalidMain.valid).toBe(false);

    const validMain = validateMainTarballEntries([
      'package/bin/curlydots.exe',
      'package/install.cjs',
    ]);
    expect(validMain.valid).toBe(true);
  });

  it('validates platform package tarball entries and manifest contracts', () => {
    const target = PLATFORM_PACKAGE_TARGETS[0];
    if (!target) {
      throw new Error('Missing platform target fixture');
    }

    const entries = [`package/${target.binarySubpath}`];
    const entryValidation = validatePlatformTarballEntries(entries, target);
    expect(entryValidation.valid).toBe(true);

    const manifestValidation = validatePlatformManifest(
      {
        name: target.packageName,
        version: '1.0.0',
        os: [target.os],
        cpu: [target.cpu],
        publishConfig: { access: 'public' },
      },
      target,
      '1.0.0',
    );
    expect(manifestValidation.valid).toBe(true);
  });

  it('validates main package manifest with exact optional dependency set', () => {
    const manifestValidation = validateMainManifest(
      {
        name: '@curlydots/cli',
        version: '1.0.0',
        bin: { curlydots: 'bin/curlydots.exe' },
        scripts: { postinstall: 'node install.cjs' },
        publishConfig: { access: 'public' },
        optionalDependencies: Object.fromEntries(
          PLATFORM_PACKAGE_NAMES.map((packageName) => [packageName, '1.0.0']),
        ),
      },
      '1.0.0',
      PLATFORM_PACKAGE_NAMES,
    );

    expect(manifestValidation.valid).toBe(true);
  });

  it('enforces tarball size budgets for all packages', () => {
    const valid = validateTarballSizeBudget('@curlydots/cli-darwin-arm64', 10 * 1024 * 1024);
    expect(valid.valid).toBe(true);
    expect(valid.exceedBytes).toBe(0);

    const invalid = validateTarballSizeBudget(
      '@curlydots/cli-win32-x64',
      TARBALL_SIZE_BUDGET_BYTES['@curlydots/cli-win32-x64'] + 1,
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toBe('exceeds-budget');
    expect(invalid.exceedBytes).toBe(1);
  });

  it('fails budget validation when no package budget exists', () => {
    const result = validateTarballSizeBudget('@curlydots/cli-unknown', 1234);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('missing-budget');
  });
});
