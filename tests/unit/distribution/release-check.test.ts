import { describe, expect, it } from 'bun:test';

import {
  REQUIRED_RELEASE_ARCHIVES,
  validateNpmPackageEntries,
  validateReleaseArtifactSet,
  validateSha256SumsContent,
} from '../../../scripts/distribution/release-check.mjs';

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

  it('checks npm tarball contents for launcher and vendor directories', () => {
    const missingVendor = validateNpmPackageEntries(['package/bin/curlydots.js']);
    expect(missingVendor.valid).toBe(false);

    const valid = validateNpmPackageEntries([
      'package/bin/curlydots.js',
      'package/vendor/x86_64-unknown-linux-musl/curlydots/curlydots',
    ]);

    expect(valid).toEqual({
      hasLauncher: true,
      hasVendorDir: true,
      valid: true,
    });
  });
});
