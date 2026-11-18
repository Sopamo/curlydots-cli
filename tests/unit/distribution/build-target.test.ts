import { describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resolveWindowsArchiveCommand } from '../../../scripts/distribution/build-target.mjs';

describe('distribution/build-target', () => {
  it('prefers pwsh over other Windows archivers', () => {
    const command = resolveWindowsArchiveCommand((candidate, probeArgs) => {
      if (candidate === 'pwsh') {
        expect(probeArgs).toEqual([
          '-NoProfile',
          '-Command',
          '$PSVersionTable.PSVersion.ToString()',
        ]);
        return true;
      }

      return false;
    });

    expect(command).toEqual({
      type: 'powershell',
      command: 'pwsh',
    });
  });

  it('falls back to powershell.exe and then zip/tar', () => {
    const preferred = resolveWindowsArchiveCommand((candidate) => candidate === 'powershell.exe');
    expect(preferred).toEqual({
      type: 'powershell',
      command: 'powershell.exe',
    });

    const zipFallback = resolveWindowsArchiveCommand((candidate) => candidate === 'zip');
    expect(zipFallback).toEqual({
      type: 'zip',
      command: 'zip',
    });

    const tarFallback = resolveWindowsArchiveCommand((candidate) => candidate === 'tar');
    expect(tarFallback).toEqual({
      type: 'tar',
      command: 'tar',
    });
  });

  it('returns null when no archiver is available', () => {
    const command = resolveWindowsArchiveCommand(() => false);
    expect(command).toBeNull();
  });
});

it.skipIf(process.platform === 'win32')(
  'packages a native binary that runs on the build host',
  () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'curlydots-native-smoke-'));
    try {
      const entrypoint = path.join(directory, 'smoke.ts');
      writeFileSync(entrypoint, 'console.log("native-build-ok");');
      const target = `bun-${process.platform}-${process.arch === 'x64' ? 'x64' : 'arm64'}`;
      const output = execFileSync(
        process.execPath,
        [
          'run',
          path.resolve(import.meta.dir, '../../../scripts/distribution/build-target.mjs'),
          '--bun-target',
          target,
          '--target-triple',
          'native-smoke',
          '--entrypoint',
          entrypoint,
          '--output-dir',
          directory,
        ],
        { encoding: 'utf8' },
      );
      expect(output).toContain(`"buildArchitecture":"${process.arch}"`);
      execFileSync('tar', [
        '-xzf',
        path.join(directory, 'curlydots-native-smoke.tar.gz'),
        '-C',
        directory,
      ]);
      expect(execFileSync(path.join(directory, 'curlydots'), [], { encoding: 'utf8' }).trim()).toBe(
        'native-build-ok',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
  30_000,
);
