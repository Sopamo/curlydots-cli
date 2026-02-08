#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { PLATFORM_PACKAGE_NAMES } from './targets.mjs';

export function parseArgs(argv) {
  const args = {
    version: null,
    outputDir: 'dist/npm',
    packageRoot: process.cwd(),
    platformMetadata: null,
    metadataFile: null,
    stagingDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--version') {
      args.version = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--output-dir') {
      args.outputDir = argv[index + 1] ?? args.outputDir;
      index += 1;
      continue;
    }

    if (argument === '--package-root') {
      args.packageRoot = argv[index + 1] ?? args.packageRoot;
      index += 1;
      continue;
    }

    if (argument === '--platform-metadata') {
      args.platformMetadata = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--metadata-file') {
      args.metadataFile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--staging-dir') {
      args.stagingDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!args.version) {
    throw new Error('Missing required argument: --version');
  }

  if (!args.platformMetadata) {
    throw new Error('Missing required argument: --platform-metadata');
  }

  return args;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${commandArgs.join(' ')}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }

  return result.stdout.trim();
}

export function normalizePlatformMetadata(rawMetadata) {
  if (!rawMetadata || !Array.isArray(rawMetadata.packages)) {
    throw new Error('Invalid platform metadata: expected a packages array');
  }

  const packageNames = rawMetadata.packages.map((entry) => entry.name).sort();
  const expected = [...PLATFORM_PACKAGE_NAMES].sort();
  if (packageNames.length !== expected.length) {
    throw new Error(
      `Invalid platform metadata: expected ${expected.length} packages, got ${packageNames.length}`,
    );
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (packageNames[index] !== expected[index]) {
      throw new Error(
        `Invalid platform metadata: expected package ${expected[index]} but got ${packageNames[index]}`,
      );
    }
  }

  return rawMetadata.packages;
}

export function buildMainPackageManifest(baseManifest, version, platformPackages) {
  const optionalDependencies = Object.fromEntries(
    platformPackages
      .map((entry) => entry.name)
      .sort()
      .map((name) => [name, version]),
  );

  const manifest = {
    name: '@curlydots/cli',
    version,
    private: false,
    bin: {
      curlydots: 'bin/curlydots.exe',
    },
    scripts: {
      postinstall: 'node install.cjs',
    },
    optionalDependencies,
    files: ['bin', 'install.cjs', 'README.md'],
    publishConfig: {
      access: 'public',
    },
  };

  if (baseManifest.description) {
    manifest.description = baseManifest.description;
  }

  if (baseManifest.repository) {
    manifest.repository = baseManifest.repository;
  }

  if (baseManifest.license) {
    manifest.license = baseManifest.license;
  }

  return manifest;
}

export function stageMainPackage({
  version,
  outputDir,
  packageRoot,
  stagingDir,
  platformMetadataPath,
}) {
  const resolvedOutputDir = path.resolve(outputDir);
  const resolvedPackageRoot = path.resolve(packageRoot);
  const resolvedPlatformMetadataPath = path.resolve(platformMetadataPath);

  mkdirSync(resolvedOutputDir, { recursive: true });
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(path.join(stagingDir, 'bin'), { recursive: true });

  const baseManifest = JSON.parse(
    readFileSync(path.join(resolvedPackageRoot, 'package.json'), 'utf8'),
  );
  const rawPlatformMetadata = JSON.parse(readFileSync(resolvedPlatformMetadataPath, 'utf8'));
  const platformPackages = normalizePlatformMetadata(rawPlatformMetadata);

  copyFileSync(
    path.join(resolvedPackageRoot, 'scripts', 'distribution', 'install-native-binary.cjs'),
    path.join(stagingDir, 'install.cjs'),
  );
  copyFileSync(
    path.join(resolvedPackageRoot, 'bin', 'curlydots.exe'),
    path.join(stagingDir, 'bin', 'curlydots.exe'),
  );
  copyFileSync(path.join(resolvedPackageRoot, 'README.md'), path.join(stagingDir, 'README.md'));

  const publishManifest = buildMainPackageManifest(baseManifest, version, platformPackages);
  writeFileSync(
    path.join(stagingDir, 'package.json'),
    `${JSON.stringify(publishManifest, null, 2)}\n`,
  );

  const packOutput = run('npm', ['pack', '--pack-destination', resolvedOutputDir], {
    cwd: stagingDir,
  });
  const tarballFile = packOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (!tarballFile) {
    throw new Error('npm pack did not emit main package tarball name');
  }

  return {
    version,
    name: '@curlydots/cli',
    outputDir: resolvedOutputDir,
    stagingDir,
    tarballFile,
    tarballPath: path.join(resolvedOutputDir, tarballFile),
    optionalDependencies: Object.keys(publishManifest.optionalDependencies).sort(),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const temporaryStagingDir = mkdtempSync(path.join(os.tmpdir(), 'curlydots-main-stage-'));
  const resolvedStagingDir = args.stagingDir ? path.resolve(args.stagingDir) : temporaryStagingDir;
  const shouldCleanup = !args.stagingDir;

  mkdirSync(resolvedStagingDir, { recursive: true });

  try {
    const metadata = stageMainPackage({
      version: args.version,
      outputDir: args.outputDir,
      packageRoot: args.packageRoot,
      stagingDir: resolvedStagingDir,
      platformMetadataPath: args.platformMetadata,
    });

    if (args.metadataFile) {
      writeFileSync(
        path.resolve(args.metadataFile),
        `${JSON.stringify(metadata, null, 2)}\n`,
        'utf8',
      );
    }

    console.log(JSON.stringify(metadata, null, 2));
  } finally {
    if (shouldCleanup) {
      rmSync(temporaryStagingDir, { recursive: true, force: true });
    }
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main();
}
