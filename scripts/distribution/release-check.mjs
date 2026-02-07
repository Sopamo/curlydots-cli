#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const REQUIRED_RELEASE_ARCHIVES = [
  'curlydots-x86_64-unknown-linux-musl.tar.gz',
  'curlydots-aarch64-unknown-linux-musl.tar.gz',
  'curlydots-x86_64-apple-darwin.tar.gz',
  'curlydots-aarch64-apple-darwin.tar.gz',
  'curlydots-x86_64-pc-windows-msvc.zip',
];

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

export function validateNpmPackageEntries(entries) {
  const hasLauncher = entries.includes('package/bin/curlydots.js');
  const hasVendorDir = entries.some((entry) => entry.startsWith('package/vendor/'));

  return {
    hasLauncher,
    hasVendorDir,
    valid: hasLauncher && hasVendorDir,
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

function parseArgs(argv) {
  const args = {
    artifactsDir: null,
    npmTarball: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--artifacts-dir') {
      args.artifactsDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--npm-tarball') {
      args.npmTarball = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!args.artifactsDir) {
    throw new Error('Missing required argument: --artifacts-dir');
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

  if (args.npmTarball) {
    const npmTarball = path.resolve(args.npmTarball);
    const tarEntries = readTgzEntries(npmTarball);
    const npmValidation = validateNpmPackageEntries(tarEntries);

    if (!npmValidation.valid) {
      if (!npmValidation.hasLauncher) {
        console.error('npm tarball is missing package/bin/curlydots.js');
      }

      if (!npmValidation.hasVendorDir) {
        console.error('npm tarball is missing package/vendor/ contents');
      }

      process.exit(1);
    }
  }

  console.log('release-check: artifacts and npm package look valid.');
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
