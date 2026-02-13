#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { PLATFORM_PACKAGE_TARGETS } from './targets.mjs';

export function parseArgs(argv) {
  const args = {
    version: null,
    artifactsDir: null,
    outputDir: 'dist/npm',
    packageRoot: process.cwd(),
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

    if (argument === '--artifacts-dir') {
      args.artifactsDir = argv[index + 1] ?? null;
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

  if (!args.artifactsDir) {
    throw new Error('Missing required argument: --artifacts-dir');
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

function extractArtifact(artifactPath, destinationDir) {
  mkdirSync(destinationDir, { recursive: true });

  if (artifactPath.endsWith('.tar.gz')) {
    run('tar', ['-xzf', artifactPath, '-C', destinationDir]);
    return;
  }

  if (artifactPath.endsWith('.zip')) {
    run('unzip', ['-o', artifactPath, '-d', destinationDir]);
    return;
  }

  throw new Error(`Unsupported artifact format: ${artifactPath}`);
}

export function buildPlatformPackageManifest(baseManifest, target, version) {
  const description = baseManifest.description
    ? `${baseManifest.description} (${target.os}/${target.cpu} native binary)`
    : `CurlyDots native binary for ${target.os}/${target.cpu}.`;

  const manifest = {
    name: target.packageName,
    version,
    description,
    private: false,
    os: [target.os],
    cpu: [target.cpu],
    files: ['bin', 'README.md'],
    publishConfig: {
      access: 'public',
    },
  };

  if (baseManifest.repository) {
    manifest.repository = baseManifest.repository;
  }

  if (baseManifest.license) {
    manifest.license = baseManifest.license;
  }

  return manifest;
}

function createPlatformPackageReadme(target) {
  return [
    `# ${target.packageName}`,
    '',
    'Platform-specific native binary package for CurlyDots CLI.',
    '',
    'Install the main package instead:',
    '',
    '```bash',
    'npm i -g @curlydots/cli',
    '```',
    '',
  ].join('\n');
}

function packageDirName(packageName) {
  return packageName.replace('@', '').replace('/', '-');
}

export function stagePlatformPackages({
  version,
  artifactsDir,
  outputDir,
  packageRoot,
  stagingDir,
}) {
  const resolvedArtifactsDir = path.resolve(artifactsDir);
  const resolvedOutputDir = path.resolve(outputDir);
  const resolvedPackageRoot = path.resolve(packageRoot);

  mkdirSync(resolvedOutputDir, { recursive: true });

  const baseManifest = JSON.parse(
    readFileSync(path.join(resolvedPackageRoot, 'package.json'), 'utf8'),
  );
  const packages = [];

  for (const target of PLATFORM_PACKAGE_TARGETS) {
    const artifactPath = path.join(resolvedArtifactsDir, target.artifact);
    if (!existsSync(artifactPath)) {
      throw new Error(`Missing artifact: ${artifactPath}`);
    }

    const targetStagingDir = path.join(stagingDir, packageDirName(target.packageName));
    const extractDir = path.join(targetStagingDir, '.extract');
    const destinationBinaryName = path.basename(target.binarySubpath);
    const destinationBinaryPath = path.join(targetStagingDir, 'bin', destinationBinaryName);

    rmSync(targetStagingDir, { recursive: true, force: true });
    mkdirSync(path.join(targetStagingDir, 'bin'), { recursive: true });

    extractArtifact(artifactPath, extractDir);
    const sourceBinaryPath = path.join(extractDir, target.binaryName);
    if (!existsSync(sourceBinaryPath)) {
      throw new Error(`Expected binary not found after extraction: ${sourceBinaryPath}`);
    }

    copyFileSync(sourceBinaryPath, destinationBinaryPath);
    if (!destinationBinaryName.endsWith('.exe')) {
      chmodSync(destinationBinaryPath, 0o755);
    }

    const manifest = buildPlatformPackageManifest(baseManifest, target, version);
    writeFileSync(
      path.join(targetStagingDir, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      path.join(targetStagingDir, 'README.md'),
      createPlatformPackageReadme(target),
      'utf8',
    );

    const packOutput = run('npm', ['pack', '--pack-destination', resolvedOutputDir], {
      cwd: targetStagingDir,
    });
    const tarballFile = packOutput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);

    if (!tarballFile) {
      throw new Error(`npm pack did not emit tarball name for ${target.packageName}`);
    }

    packages.push({
      name: target.packageName,
      targetTriple: target.targetTriple,
      os: target.os,
      cpu: target.cpu,
      artifact: target.artifact,
      binarySubpath: target.binarySubpath,
      tarballFile,
      tarballPath: path.join(resolvedOutputDir, tarballFile),
    });

    rmSync(extractDir, { recursive: true, force: true });
  }

  return {
    version,
    artifactsDir: resolvedArtifactsDir,
    outputDir: resolvedOutputDir,
    stagingDir,
    packages,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const temporaryStagingDir = mkdtempSync(path.join(os.tmpdir(), 'curlydots-platform-stage-'));
  const resolvedStagingDir = args.stagingDir ? path.resolve(args.stagingDir) : temporaryStagingDir;
  const shouldCleanup = !args.stagingDir;

  mkdirSync(resolvedStagingDir, { recursive: true });

  try {
    const metadata = stagePlatformPackages({
      version: args.version,
      artifactsDir: args.artifactsDir,
      outputDir: args.outputDir,
      packageRoot: args.packageRoot,
      stagingDir: resolvedStagingDir,
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
