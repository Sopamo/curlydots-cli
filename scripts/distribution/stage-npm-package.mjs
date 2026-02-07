#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const RELEASE_TARGETS = [
  {
    targetTriple: 'x86_64-unknown-linux-musl',
    artifact: 'curlydots-x86_64-unknown-linux-musl.tar.gz',
    binaryName: 'curlydots',
  },
  {
    targetTriple: 'aarch64-unknown-linux-musl',
    artifact: 'curlydots-aarch64-unknown-linux-musl.tar.gz',
    binaryName: 'curlydots',
  },
  {
    targetTriple: 'x86_64-apple-darwin',
    artifact: 'curlydots-x86_64-apple-darwin.tar.gz',
    binaryName: 'curlydots',
  },
  {
    targetTriple: 'aarch64-apple-darwin',
    artifact: 'curlydots-aarch64-apple-darwin.tar.gz',
    binaryName: 'curlydots',
  },
  {
    targetTriple: 'x86_64-pc-windows-msvc',
    artifact: 'curlydots-x86_64-pc-windows-msvc.zip',
    binaryName: 'curlydots.exe',
  },
];

function parseArgs(argv) {
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

  if (result.status !== 0) {
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    throw new Error(`Command failed: ${command} ${commandArgs.join(' ')}\n${stdout}\n${stderr}`);
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

function buildPublishManifest(baseManifest, version) {
  return {
    ...baseManifest,
    name: '@curlydots/cli',
    private: false,
    version,
    bin: {
      curlydots: 'bin/curlydots.js',
    },
    files: ['bin', 'vendor', 'README.md'],
    publishConfig: {
      access: 'public',
    },
  };
}

function stageVendorArtifacts({ artifactsDir, stagingDir }) {
  for (const target of RELEASE_TARGETS) {
    const artifactPath = path.join(artifactsDir, target.artifact);
    if (!existsSync(artifactPath)) {
      throw new Error(`Missing artifact: ${artifactPath}`);
    }

    const destinationDir = path.join(stagingDir, 'vendor', target.targetTriple, 'curlydots');
    extractArtifact(artifactPath, destinationDir);

    const binaryPath = path.join(destinationDir, target.binaryName);
    if (!existsSync(binaryPath)) {
      throw new Error(`Extracted artifact is missing expected binary: ${binaryPath}`);
    }

    if (!target.binaryName.endsWith('.exe')) {
      chmodSync(binaryPath, 0o755);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactsDir = path.resolve(args.artifactsDir);
  const outputDir = path.resolve(args.outputDir);
  const packageRoot = path.resolve(args.packageRoot);

  mkdirSync(outputDir, { recursive: true });

  const temporaryStagingDir = mkdtempSync(path.join(os.tmpdir(), 'curlydots-npm-stage-'));
  const stagingDir = args.stagingDir ? path.resolve(args.stagingDir) : temporaryStagingDir;
  const shouldCleanupTempDir = !args.stagingDir;

  if (args.stagingDir) {
    mkdirSync(stagingDir, { recursive: true });
  }

  try {
    mkdirSync(path.join(stagingDir, 'bin'), { recursive: true });

    copyFileSync(
      path.join(packageRoot, 'bin', 'curlydots.js'),
      path.join(stagingDir, 'bin', 'curlydots.js'),
    );
    copyFileSync(path.join(packageRoot, 'README.md'), path.join(stagingDir, 'README.md'));

    stageVendorArtifacts({
      artifactsDir,
      stagingDir,
    });

    const baseManifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    const publishManifest = buildPublishManifest(baseManifest, args.version);
    writeFileSync(
      path.join(stagingDir, 'package.json'),
      `${JSON.stringify(publishManifest, null, 2)}\n`,
      'utf8',
    );

    const packOutput = run('npm', ['pack', '--pack-destination', outputDir], {
      cwd: stagingDir,
    })
      .split('\n')
      .filter(Boolean)
      .at(-1);

    if (!packOutput) {
      throw new Error('npm pack did not produce output');
    }

    const generatedTarballPath = path.join(outputDir, packOutput);
    const finalTarballPath = path.join(outputDir, `curlydots-npm-${args.version}.tgz`);
    renameSync(generatedTarballPath, finalTarballPath);

    const metadata = {
      version: args.version,
      tarballPath: finalTarballPath,
      stagingDir,
      artifactsDir,
    };

    if (args.metadataFile) {
      writeFileSync(
        path.resolve(args.metadataFile),
        `${JSON.stringify(metadata, null, 2)}\n`,
        'utf8',
      );
    }

    console.log(JSON.stringify(metadata, null, 2));
  } finally {
    if (shouldCleanupTempDir) {
      rmSync(temporaryStagingDir, { recursive: true, force: true });
    }
  }
}

main();
