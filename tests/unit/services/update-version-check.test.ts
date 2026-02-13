import { describe, expect, it } from 'bun:test';

import {
  compareSemver,
  fetchLatestPackageVersion,
  isNewerVersion,
  maybeRunSelfUpdate,
  resolveNpmLatestUrl,
  runNpmUpdate,
  shouldSkipUpdateCheck,
} from '../../../src/services/update/version-check';

describe('services/update/version-check', () => {
  it('compares semver including prerelease precedence', () => {
    expect(compareSemver('1.2.3', '1.2.4')).toBeLessThan(0);
    expect(compareSemver('1.2.3-beta.1', '1.2.3')).toBeLessThan(0);
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(true);
  });

  it('builds npm latest URL with encoded scope', () => {
    const url = resolveNpmLatestUrl('@curlydots/cli');
    expect(url).toBe('https://registry.npmjs.org/%40curlydots%2Fcli/latest');
  });

  it('skips update checks in non-interactive and CI environments, and for --version', () => {
    expect(shouldSkipUpdateCheck({ argv: ['extract'], isTTY: false })).toBe(true);
    expect(shouldSkipUpdateCheck({ argv: ['extract'], isTTY: true, env: { CI: 'true' } })).toBe(
      true,
    );
    expect(shouldSkipUpdateCheck({ argv: ['--version'], isTTY: true, env: {} })).toBe(true);
    expect(shouldSkipUpdateCheck({ argv: ['extract'], isTTY: true, env: {} })).toBe(false);
  });

  it('reads latest package version from npm registry payload', async () => {
    const version = await fetchLatestPackageVersion({
      packageName: '@curlydots/cli',
      fetchImpl: async () =>
        new Response(JSON.stringify({ version: '9.9.9' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    expect(version).toBe('9.9.9');
  });

  it('runs npm global update with platform-specific npm command', () => {
    let invokedCommand = '';
    let invokedArgs: string[] = [];

    const updatedUnix = runNpmUpdate({
      packageName: '@curlydots/cli',
      platform: 'linux',
      spawnSyncImpl: ((command: string, args: string[]) => {
        invokedCommand = command;
        invokedArgs = args;
        return { status: 0 };
      }) as unknown as typeof import('node:child_process').spawnSync,
    });
    expect(updatedUnix).toBe(true);
    expect(invokedCommand).toBe('npm');
    expect(invokedArgs).toContain('@curlydots/cli@latest');

    const updatedWindows = runNpmUpdate({
      packageName: '@curlydots/cli',
      platform: 'win32',
      spawnSyncImpl: ((command: string) => {
        invokedCommand = command;
        return { status: 0 };
      }) as unknown as typeof import('node:child_process').spawnSync,
    });
    expect(updatedWindows).toBe(true);
    expect(invokedCommand).toBe('npm.cmd');
  });

  it('does not prompt when latest version is unavailable', async () => {
    let prompted = false;
    let updated = false;

    const result = await maybeRunSelfUpdate({
      argv: ['extract'],
      currentVersion: '1.0.0',
      packageName: '@curlydots/cli',
      env: {},
      isTTY: true,
      fetchLatestVersionImpl: async () => null,
      promptForUpdateImpl: async () => {
        prompted = true;
        return true;
      },
      runNpmUpdateImpl: () => {
        updated = true;
        return true;
      },
      logger: {
        warn: () => undefined,
        success: () => undefined,
      },
    });

    expect(result.status).toBe('check-failed');
    expect(prompted).toBe(false);
    expect(updated).toBe(false);
  });

  it('prompts and runs update when a newer version exists and user accepts', async () => {
    let prompted = false;
    let updated = false;
    let promptCurrentVersion = '';
    let promptLatestVersion = '';
    let promptPackageName = '';
    let updatePackageName = '';
    const successMessages: string[] = [];

    const result = await maybeRunSelfUpdate({
      argv: ['extract'],
      currentVersion: '1.0.0',
      packageName: '@curlydots/cli',
      env: {},
      isTTY: true,
      fetchLatestVersionImpl: async () => '1.1.0',
      promptForUpdateImpl: async (options) => {
        prompted = true;
        promptCurrentVersion = options.currentVersion;
        promptLatestVersion = options.latestVersion;
        promptPackageName = options.packageName;
        return true;
      },
      runNpmUpdateImpl: (options) => {
        updated = true;
        updatePackageName = options.packageName;
        return true;
      },
      logger: {
        warn: () => undefined,
        success: (message) => {
          successMessages.push(message);
        },
      },
    });

    expect(result).toEqual({
      status: 'updated',
      latestVersion: '1.1.0',
    });
    expect(prompted).toBe(true);
    expect(updated).toBe(true);
    expect(promptCurrentVersion).toBe('1.0.0');
    expect(promptLatestVersion).toBe('1.1.0');
    expect(promptPackageName).toBe('@curlydots/cli');
    expect(updatePackageName).toBe('@curlydots/cli');
    expect(successMessages).toContain(
      'Updated @curlydots/cli to 1.1.0. Restart CurlyDots to use the new version.',
    );
  });

  it('does not update when user declines', async () => {
    let updated = false;
    const result = await maybeRunSelfUpdate({
      argv: ['extract'],
      currentVersion: '1.0.0',
      packageName: '@curlydots/cli',
      env: {},
      isTTY: true,
      fetchLatestVersionImpl: async () => '1.1.0',
      promptForUpdateImpl: async () => false,
      runNpmUpdateImpl: () => {
        updated = true;
        return true;
      },
      logger: {
        warn: () => undefined,
        success: () => undefined,
      },
    });

    expect(result.status).toBe('declined');
    expect(result.latestVersion).toBe('1.1.0');
    expect(updated).toBe(false);
  });
});
