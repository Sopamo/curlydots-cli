#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = {
    bunTarget: null,
    targetTriple: null,
    outputDir: 'dist/release',
    entrypoint: 'src/index.ts',
    binaryName: 'curlydots',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--bun-target') {
      args.bunTarget = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--target-triple') {
      args.targetTriple = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--output-dir') {
      args.outputDir = argv[index + 1] ?? args.outputDir;
      index += 1;
      continue;
    }

    if (argument === '--entrypoint') {
      args.entrypoint = argv[index + 1] ?? args.entrypoint;
      index += 1;
      continue;
    }

    if (argument === '--binary-name') {
      args.binaryName = argv[index + 1] ?? args.binaryName;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!args.bunTarget) {
    throw new Error('Missing required argument: --bun-target');
  }

  if (!args.targetTriple) {
    throw new Error('Missing required argument: --target-triple');
  }

  return args;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${commandArgs.join(' ')}`);
  }
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function archiveBinary({ binaryPath, artifactPath, isWindows }) {
  if (isWindows) {
    if (commandExists('powershell')) {
      const command = `Compress-Archive -Path '${binaryPath.replace(/'/g, "''")}' -DestinationPath '${artifactPath.replace(/'/g, "''")}' -Force`;
      run('powershell', ['-NoProfile', '-Command', command]);
      return;
    }

    if (commandExists('zip')) {
      run('zip', ['-j', artifactPath, binaryPath]);
      return;
    }

    throw new Error(
      'Unable to create Windows ZIP archive. Expected powershell (Compress-Archive) or zip command.',
    );
  }

  run('tar', ['-czf', artifactPath, '-C', path.dirname(binaryPath), path.basename(binaryPath)]);
}

function sha256ForFile(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

function ensureFile(filePath) {
  const stats = statSync(filePath);
  if (!stats.isFile() || stats.size <= 0) {
    throw new Error(`Expected non-empty file: ${filePath}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir);
  mkdirSync(outputDir, { recursive: true });

  const isWindowsTarget = args.targetTriple.includes('windows');
  const binaryFilename = isWindowsTarget ? `${args.binaryName}.exe` : args.binaryName;
  const artifactFilename = `${args.binaryName}-${args.targetTriple}${isWindowsTarget ? '.zip' : '.tar.gz'}`;

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'curlydots-build-target-'));

  try {
    const compiledBinaryPath = path.join(tempDir, binaryFilename);
    const artifactPath = path.join(outputDir, artifactFilename);

    run('bun', [
      'build',
      '--compile',
      `--target=${args.bunTarget}`,
      `--outfile=${compiledBinaryPath}`,
      path.resolve(args.entrypoint),
    ]);

    ensureFile(compiledBinaryPath);

    archiveBinary({
      binaryPath: compiledBinaryPath,
      artifactPath,
      isWindows: isWindowsTarget,
    });

    ensureFile(artifactPath);

    const checksum = sha256ForFile(artifactPath);
    const checksumPath = `${artifactPath}.sha256`;
    writeFileSync(checksumPath, `${checksum}  ${path.basename(artifactPath)}\n`, 'utf8');

    console.log(
      JSON.stringify(
        {
          artifactPath,
          checksumPath,
          checksum,
          targetTriple: args.targetTriple,
          bunTarget: args.bunTarget,
        },
        null,
        2,
      ),
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
