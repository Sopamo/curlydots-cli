import { describe, expect, it } from 'bun:test';

import { resolveWindowsArchiveCommand } from '../../../scripts/distribution/build-target.mjs';

describe('distribution/build-target', () => {
  it('prefers pwsh over other Windows archivers', () => {
    const command = resolveWindowsArchiveCommand((candidate, probeArgs) => {
      if (candidate === 'pwsh') {
        expect(probeArgs).toEqual(['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']);
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
