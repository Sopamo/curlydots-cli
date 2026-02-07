#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const WINDOWS_ARM64_UNSUPPORTED_MESSAGE =
  'Windows ARM64 is currently unsupported because Bun cannot compile target bun-windows-arm64 as of February 7, 2026.';

export const DEFAULT_FORWARD_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveTargetTriple(platform = process.platform, arch = process.arch) {
  if ((platform === 'linux' || platform === 'android') && arch === 'x64') {
    return 'x86_64-unknown-linux-musl';
  }

  if ((platform === 'linux' || platform === 'android') && arch === 'arm64') {
    return 'aarch64-unknown-linux-musl';
  }

  if (platform === 'darwin' && arch === 'x64') {
    return 'x86_64-apple-darwin';
  }

  if (platform === 'darwin' && arch === 'arm64') {
    return 'aarch64-apple-darwin';
  }

  if (platform === 'win32' && arch === 'x64') {
    return 'x86_64-pc-windows-msvc';
  }

  if (platform === 'win32' && arch === 'arm64') {
    throw new Error(WINDOWS_ARM64_UNSUPPORTED_MESSAGE);
  }

  throw new Error(`Unsupported platform: ${platform}/${arch}`);
}

export function resolveBinaryFilename(targetTriple) {
  return targetTriple.includes('windows') ? 'curlydots.exe' : 'curlydots';
}

export function resolveBinaryPath({ vendorRoot, targetTriple }) {
  return path.join(vendorRoot, targetTriple, 'curlydots', resolveBinaryFilename(targetTriple));
}

export function attachSignalForwarding({ processRef, child, signals = DEFAULT_FORWARD_SIGNALS }) {
  const unsubscribe = [];
  const removeListener =
    processRef.off?.bind(processRef) ?? processRef.removeListener?.bind(processRef);

  for (const signal of signals) {
    const handler = () => {
      if (child.killed) {
        return;
      }

      try {
        child.kill(signal);
      } catch {
        // Swallow signal forwarding errors because the child may already be dead.
      }
    };

    processRef.on(signal, handler);
    unsubscribe.push(() => {
      if (removeListener) {
        removeListener(signal, handler);
      }
    });
  }

  return () => {
    for (const cleanup of unsubscribe) {
      cleanup();
    }
  };
}

export async function runCliBinary({
  argv = process.argv.slice(2),
  platform = process.platform,
  arch = process.arch,
  env = process.env,
  moduleDir = __dirname,
  processRef = process,
  spawnImpl = spawn,
  existsImpl = existsSync,
} = {}) {
  const targetTriple = resolveTargetTriple(platform, arch);
  const vendorRoot = path.join(moduleDir, '..', 'vendor');
  const binaryPath = resolveBinaryPath({ vendorRoot, targetTriple });

  if (!existsImpl(binaryPath)) {
    throw new Error(`Curlydots binary not found for ${targetTriple}: ${binaryPath}`);
  }

  const child = spawnImpl(binaryPath, argv, {
    stdio: 'inherit',
    env: {
      ...env,
    },
  });

  const cleanupSignals = attachSignalForwarding({
    processRef,
    child,
  });

  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (signal) {
          resolve({ signal, code: null });
          return;
        }

        resolve({ signal: null, code: code ?? 1 });
      });
    });
  } finally {
    cleanupSignals();
  }
}

function isMainModule(moduleUrl) {
  if (!process.argv[1]) {
    return false;
  }

  return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(process.argv[1]);
}

async function main() {
  const result = await runCliBinary();

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }

  process.exit(result.code);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
