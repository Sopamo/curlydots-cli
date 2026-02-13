import { describe, expect, it } from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function loadInstaller() {
  const module = await import('../../../scripts/distribution/install-native-binary.cjs');
  return (module.default ?? module) as {
    WINDOWS_ARM64_UNSUPPORTED_MESSAGE: string;
    linkInstalledBinary: (args: {
      sourcePath: string;
      destinationPath: string;
      platform?: string;
      operations?: {
        mkdirSync: typeof mkdirSync;
        rmSync: typeof rmSync;
        linkSync: (sourcePath: string, destinationPath: string) => void;
        symlinkSync: (
          targetPath: string,
          destinationPath: string,
          type?: 'dir' | 'file' | 'junction',
        ) => void;
        copyFileSync: typeof copyFileSync;
        chmodSync: typeof chmodSync;
      };
    }) => { method: string };
    installNativeBinary: (args: {
      packageRoot: string;
      platform: string;
      arch: string;
      requireResolve?: (specifier: string, options?: { paths?: string[] }) => string;
      spawnSyncImpl?: (...args: unknown[]) => { status: number; error?: Error };
    }) => { destinationPath: string; sourcePath: string; packageName: string };
    resolveRuntimeTarget: (
      platform: string,
      arch: string,
    ) => {
      packageName: string;
      binarySubpath: string;
    };
  };
}

function makeTempDir(prefix: string) {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('distribution/install-native-binary', () => {
  it('maps supported platforms to platform package names', async () => {
    const installer = await loadInstaller();

    expect(installer.resolveRuntimeTarget('linux', 'x64').packageName).toBe(
      '@curlydots/cli-linux-x64',
    );
    expect(installer.resolveRuntimeTarget('linux', 'arm64').packageName).toBe(
      '@curlydots/cli-linux-arm64',
    );
    expect(installer.resolveRuntimeTarget('darwin', 'x64').packageName).toBe(
      '@curlydots/cli-darwin-x64',
    );
    expect(installer.resolveRuntimeTarget('darwin', 'arm64').packageName).toBe(
      '@curlydots/cli-darwin-arm64',
    );
    expect(installer.resolveRuntimeTarget('win32', 'x64').packageName).toBe(
      '@curlydots/cli-win32-x64',
    );
  });

  it('throws explicit error for Windows ARM64', async () => {
    const installer = await loadInstaller();

    expect(() => installer.resolveRuntimeTarget('win32', 'arm64')).toThrow(
      installer.WINDOWS_ARM64_UNSUPPORTED_MESSAGE,
    );
  });

  it('links the resolved binary to the top-level bin path without copy duplication', async () => {
    const installer = await loadInstaller();
    const tempDir = makeTempDir('curlydots-install-link-');

    try {
      const sourcePath = path.join(tempDir, 'source', 'curlydots');
      const destinationPath = path.join(tempDir, 'bin', 'curlydots.exe');
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      writeFileSync(sourcePath, 'native-binary');

      const result = installer.linkInstalledBinary({
        sourcePath,
        destinationPath,
        platform: 'linux',
      });

      expect(readFileSync(destinationPath, 'utf8')).toBe('native-binary');
      expect(result.method).not.toBe('copy');

      if (result.method === 'hardlink') {
        expect(statSync(sourcePath).ino).toBe(statSync(destinationPath).ino);
      }

      if (result.method === 'symlink') {
        expect(lstatSync(destinationPath).isSymbolicLink()).toBe(true);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to copying when hardlink and symlink fail', async () => {
    const installer = await loadInstaller();
    const tempDir = makeTempDir('curlydots-install-link-fallback-');

    try {
      const sourcePath = path.join(tempDir, 'source', 'curlydots');
      const destinationPath = path.join(tempDir, 'bin', 'curlydots.exe');
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      writeFileSync(sourcePath, 'native-binary');

      const result = installer.linkInstalledBinary({
        sourcePath,
        destinationPath,
        platform: 'linux',
        operations: {
          mkdirSync,
          rmSync,
          linkSync: () => {
            throw new Error('hardlink unavailable');
          },
          symlinkSync: () => {
            throw new Error('symlink unavailable');
          },
          copyFileSync,
          chmodSync,
        },
      });

      expect(result.method).toBe('copy');
      expect(readFileSync(destinationPath, 'utf8')).toBe('native-binary');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('installs directly from already-resolved optional dependency when present', async () => {
    const installer = await loadInstaller();
    const tempDir = makeTempDir('curlydots-install-resolve-');

    try {
      const packageRoot = path.join(tempDir, 'package');
      const sourcePath = path.join(
        tempDir,
        'node_modules',
        '@curlydots',
        'cli-linux-x64',
        'bin',
        'curlydots',
      );
      const resolvedSpecifier = '@curlydots/cli-linux-x64/bin/curlydots';
      mkdirSync(path.join(packageRoot, 'bin'), { recursive: true });
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ version: '1.2.3' }));
      writeFileSync(path.join(packageRoot, 'bin', 'curlydots.exe'), 'placeholder');
      writeFileSync(sourcePath, 'linux-binary');

      const resolvedCalls: string[] = [];
      const requireResolve = (specifier: string) => {
        resolvedCalls.push(specifier);
        if (specifier === resolvedSpecifier) {
          return sourcePath;
        }

        throw new Error(`Unexpected specifier: ${specifier}`);
      };

      const result = installer.installNativeBinary({
        packageRoot,
        platform: 'linux',
        arch: 'x64',
        requireResolve,
        spawnSyncImpl: () => ({ status: 0 }),
      });

      expect(result.packageName).toBe('@curlydots/cli-linux-x64');
      expect(readFileSync(path.join(packageRoot, 'bin', 'curlydots.exe'), 'utf8')).toBe(
        'linux-binary',
      );
      expect(resolvedCalls).toContain(resolvedSpecifier);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('attempts fallback npm install when optional dependency is missing', async () => {
    const installer = await loadInstaller();
    const tempDir = makeTempDir('curlydots-install-fallback-');

    try {
      const packageRoot = path.join(tempDir, 'package');
      const sourcePath = path.join(tempDir, 'resolved', 'curlydots');
      const resolvedSpecifier = '@curlydots/cli-linux-x64/bin/curlydots';

      mkdirSync(path.join(packageRoot, 'bin'), { recursive: true });
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ version: '2.0.0' }));
      writeFileSync(path.join(packageRoot, 'bin', 'curlydots.exe'), 'placeholder');
      writeFileSync(sourcePath, 'linux-binary');

      let resolvedAfterInstall = false;
      const requireResolve = (specifier: string) => {
        if (specifier !== resolvedSpecifier || !resolvedAfterInstall) {
          throw new Error('Not found');
        }

        return sourcePath;
      };

      const commands: string[] = [];
      const spawnSyncImpl = (command: string, args: string[]) => {
        commands.push([command, ...args].join(' '));
        resolvedAfterInstall = true;
        return { status: 0 };
      };

      const result = installer.installNativeBinary({
        packageRoot,
        platform: 'linux',
        arch: 'x64',
        requireResolve,
        spawnSyncImpl: spawnSyncImpl as unknown as (...args: unknown[]) => { status: number },
      });

      expect(result.packageName).toBe('@curlydots/cli-linux-x64');
      expect(commands.length).toBe(1);
      expect(commands[0]).toContain('npm install');
      expect(commands[0]).toContain('@curlydots/cli-linux-x64@2.0.0');
      expect(readFileSync(path.join(packageRoot, 'bin', 'curlydots.exe'), 'utf8')).toBe(
        'linux-binary',
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
