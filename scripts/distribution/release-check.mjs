#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  PLATFORM_PACKAGE_NAMES,
  PLATFORM_PACKAGE_TARGETS,
  findTargetByPackageName,
} from './targets.mjs';

export const REQUIRED_RELEASE_ARCHIVES = PLATFORM_PACKAGE_TARGETS.map((target) => target.artifact);

export const TARBALL_SIZE_BUDGET_BYTES = {
  '@curlydots/cli': 128 * 1024,
  '@curlydots/cli-linux-x64': 55 * 1024 * 1024,
  '@curlydots/cli-linux-arm64': 55 * 1024 * 1024,
  '@curlydots/cli-darwin-x64': 40 * 1024 * 1024,
  '@curlydots/cli-darwin-arm64': 40 * 1024 * 1024,
  '@curlydots/cli-win32-x64': 60 * 1024 * 1024,
};

export function validateReleaseArtifactSet(fileNames) {
  const fileSet = new Set(fileNames);

  const missing = REQUIRED_RELEASE_ARCHIVES.filter((artifact) => !fileSet.has(artifact));
  const missingChecksums = REQUIRED_RELEASE_ARCHIVES.map((artifact) => `${artifact}.sha256`).filter(
    (checksumFile) => !fileSet.has(checksumFile),
  );

  const hasShaSumsFile = fileSet.has('SHA256SUMS');

  return {
    missing,
    missingChecksums,
    hasShaSumsFile,
    isValid: missing.length === 0 && missingChecksums.length === 0 && hasShaSumsFile,
  };
}

export function validateSha256SumsContent(content, requiredArchives = REQUIRED_RELEASE_ARCHIVES) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = new Map();
  for (const line of lines) {
    const match = line.match(/^([a-fA-F0-9]{64})\s{2}(.+)$/);
    if (!match) {
      return {
        malformedLine: line,
        missingEntries: requiredArchives,
        valid: false,
      };
    }

    parsed.set(match[2], match[1]);
  }

  const missingEntries = requiredArchives.filter((artifact) => !parsed.has(artifact));

  return {
    malformedLine: null,
    missingEntries,
    valid: missingEntries.length === 0,
  };
}

export function validateMainTarballEntries(entries) {
  const hasBinary = entries.includes('package/bin/curlydots.exe');
  const hasInstallScript = entries.includes('package/install.cjs');

  return {
    hasBinary,
    hasInstallScript,
    valid: hasBinary && hasInstallScript,
  };
}

export function readTgzEntries(tarballPath) {
  const result = spawnSync('tar', ['-tzf', tarballPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(`Unable to read tarball entries: ${tarballPath}\n${result.stderr ?? ''}`);
  }

  return result.stdout
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readTgzPackageJson(tarballPath) {
  const result = spawnSync('tar', ['-xOzf', tarballPath, 'package/package.json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(
      `Unable to read package.json from tarball: ${tarballPath}\n${result.stderr ?? ''}`,
    );
  }

  return JSON.parse(result.stdout);
}

export function validatePlatformTarballEntries(entries, target) {
  const expectedBinaryEntry = `package/${target.binarySubpath}`;
  return {
    expectedBinaryEntry,
    hasBinary: entries.includes(expectedBinaryEntry),
    valid: entries.includes(expectedBinaryEntry),
  };
}

export function validatePlatformManifest(manifest, target, version) {
  const osValid =
    Array.isArray(manifest.os) && manifest.os.length === 1 && manifest.os[0] === target.os;
  const cpuValid =
    Array.isArray(manifest.cpu) && manifest.cpu.length === 1 && manifest.cpu[0] === target.cpu;
  const nameValid = manifest.name === target.packageName;
  const versionValid = manifest.version === version;
  const publishConfigValid = manifest.publishConfig?.access === 'public';

  return {
    osValid,
    cpuValid,
    nameValid,
    versionValid,
    publishConfigValid,
    valid: osValid && cpuValid && nameValid && versionValid && publishConfigValid,
  };
}

export function validateMainManifest(manifest, version, expectedPackageNames) {
  const binValid = manifest.bin?.curlydots === 'bin/curlydots.exe';
  const postinstallValid = manifest.scripts?.postinstall === 'node install.cjs';
  const versionValid = manifest.version === version;
  const nameValid = manifest.name === '@curlydots/cli';
  const publishConfigValid = manifest.publishConfig?.access === 'public';
  const optionalDependencies = manifest.optionalDependencies ?? {};
  const optionalNames = Object.keys(optionalDependencies).sort();
  const expectedNames = [...expectedPackageNames].sort();
  const namesValid = JSON.stringify(optionalNames) === JSON.stringify(expectedNames);
  const versionsValid = expectedNames.every(
    (packageName) => optionalDependencies[packageName] === version,
  );

  return {
    binValid,
    postinstallValid,
    versionValid,
    nameValid,
    publishConfigValid,
    namesValid,
    versionsValid,
    valid:
      binValid &&
      postinstallValid &&
      versionValid &&
      nameValid &&
      publishConfigValid &&
      namesValid &&
      versionsValid,
  };
}

export function validateTarballSizeBudget(
  packageName,
  tarballSizeBytes,
  budgets = TARBALL_SIZE_BUDGET_BYTES,
) {
  const maxBytes = budgets[packageName];
  if (typeof maxBytes !== 'number') {
    return {
      valid: false,
      reason: 'missing-budget',
      packageName,
      tarballSizeBytes,
      maxBytes: null,
      exceedBytes: null,
    };
  }

  const exceedBytes = Math.max(0, tarballSizeBytes - maxBytes);
  return {
    valid: exceedBytes === 0,
    reason: exceedBytes === 0 ? null : 'exceeds-budget',
    packageName,
    tarballSizeBytes,
    maxBytes,
    exceedBytes,
  };
}

function parseArgs(argv) {
  const args = {
    artifactsDir: null,
    platformMetadata: null,
    mainMetadata: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--artifacts-dir') {
      args.artifactsDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--platform-metadata') {
      args.platformMetadata = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--main-metadata') {
      args.mainMetadata = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!args.artifactsDir) {
    throw new Error('Missing required argument: --artifacts-dir');
  }

  if (
    (args.platformMetadata && !args.mainMetadata) ||
    (!args.platformMetadata && args.mainMetadata)
  ) {
    throw new Error('Both --platform-metadata and --main-metadata must be provided together');
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactsDir = path.resolve(args.artifactsDir);
  const artifactFiles = readdirSync(artifactsDir);

  const artifactValidation = validateReleaseArtifactSet(artifactFiles);
  if (!artifactValidation.isValid) {
    if (artifactValidation.missing.length > 0) {
      console.error('Missing release archives:');
      for (const entry of artifactValidation.missing) {
        console.error(`  - ${entry}`);
      }
    }

    if (artifactValidation.missingChecksums.length > 0) {
      console.error('Missing per-archive checksum files:');
      for (const entry of artifactValidation.missingChecksums) {
        console.error(`  - ${entry}`);
      }
    }

    if (!artifactValidation.hasShaSumsFile) {
      console.error('Missing SHA256SUMS file.');
    }

    process.exit(1);
  }

  const sha256SumsContent = readFileSync(path.join(artifactsDir, 'SHA256SUMS'), 'utf8');
  const sha256Validation = validateSha256SumsContent(sha256SumsContent);
  if (!sha256Validation.valid) {
    if (sha256Validation.malformedLine) {
      console.error(`Malformed SHA256SUMS line: ${sha256Validation.malformedLine}`);
    }

    if (sha256Validation.missingEntries.length > 0) {
      console.error('SHA256SUMS is missing entries for:');
      for (const missing of sha256Validation.missingEntries) {
        console.error(`  - ${missing}`);
      }
    }

    process.exit(1);
  }

  if (args.platformMetadata && args.mainMetadata) {
    const platformMetadata = JSON.parse(readFileSync(path.resolve(args.platformMetadata), 'utf8'));
    const mainMetadata = JSON.parse(readFileSync(path.resolve(args.mainMetadata), 'utf8'));

    if (platformMetadata.version !== mainMetadata.version) {
      console.error(
        `Version mismatch between metadata files: platform=${platformMetadata.version} main=${mainMetadata.version}`,
      );
      process.exit(1);
    }

    if (!Array.isArray(platformMetadata.packages) || platformMetadata.packages.length !== 5) {
      console.error('Platform metadata must contain exactly five platform packages.');
      process.exit(1);
    }

    const packageNames = platformMetadata.packages.map((entry) => entry.name).sort();
    const expectedPackageNames = [...PLATFORM_PACKAGE_NAMES].sort();
    if (JSON.stringify(packageNames) !== JSON.stringify(expectedPackageNames)) {
      console.error('Platform metadata package list is invalid.');
      console.error(`Expected: ${expectedPackageNames.join(', ')}`);
      console.error(`Actual:   ${packageNames.join(', ')}`);
      process.exit(1);
    }

    for (const entry of platformMetadata.packages) {
      const target = findTargetByPackageName(entry.name);
      if (!target) {
        console.error(`Unknown platform package in metadata: ${entry.name}`);
        process.exit(1);
      }

      if (!entry.tarballPath || !existsSync(entry.tarballPath)) {
        console.error(`Missing platform tarball: ${entry.tarballPath ?? '<undefined>'}`);
        process.exit(1);
      }

      const tarEntries = readTgzEntries(entry.tarballPath);
      const tarballValidation = validatePlatformTarballEntries(tarEntries, target);
      if (!tarballValidation.valid) {
        console.error(
          `Platform tarball ${entry.tarballPath} is missing ${tarballValidation.expectedBinaryEntry}`,
        );
        process.exit(1);
      }

      const manifest = readTgzPackageJson(entry.tarballPath);
      const manifestValidation = validatePlatformManifest(
        manifest,
        target,
        platformMetadata.version,
      );
      if (!manifestValidation.valid) {
        console.error(`Platform manifest validation failed for ${entry.name}`);
        console.error(JSON.stringify(manifestValidation, null, 2));
        process.exit(1);
      }

      const tarballSizeValidation = validateTarballSizeBudget(
        entry.name,
        statSync(entry.tarballPath).size,
      );
      if (!tarballSizeValidation.valid) {
        console.error(`Tarball size exceeds budget for ${entry.name}`);
        console.error(JSON.stringify(tarballSizeValidation, null, 2));
        process.exit(1);
      }
    }

    if (!mainMetadata.tarballPath || !existsSync(mainMetadata.tarballPath)) {
      console.error(`Missing main package tarball: ${mainMetadata.tarballPath ?? '<undefined>'}`);
      process.exit(1);
    }

    const mainEntries = readTgzEntries(mainMetadata.tarballPath);
    const mainTarballValidation = validateMainTarballEntries(mainEntries);
    if (!mainTarballValidation.valid) {
      if (!mainTarballValidation.hasBinary) {
        console.error('Main package tarball is missing package/bin/curlydots.exe');
      }

      if (!mainTarballValidation.hasInstallScript) {
        console.error('Main package tarball is missing package/install.cjs');
      }

      process.exit(1);
    }

    const mainManifest = readTgzPackageJson(mainMetadata.tarballPath);
    const mainManifestValidation = validateMainManifest(
      mainManifest,
      platformMetadata.version,
      PLATFORM_PACKAGE_NAMES,
    );

    if (!mainManifestValidation.valid) {
      console.error('Main package manifest validation failed.');
      console.error(JSON.stringify(mainManifestValidation, null, 2));
      process.exit(1);
    }

    const mainTarballSizeValidation = validateTarballSizeBudget(
      '@curlydots/cli',
      statSync(mainMetadata.tarballPath).size,
    );
    if (!mainTarballSizeValidation.valid) {
      console.error('Main package tarball size exceeds budget.');
      console.error(JSON.stringify(mainTarballSizeValidation, null, 2));
      process.exit(1);
    }
  }

  console.log('release-check: artifacts and npm package metadata look valid.');
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
}

if (isMainModule()) {
  main();
}
