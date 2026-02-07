import { describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'node:events';

import {
  WINDOWS_ARM64_UNSUPPORTED_MESSAGE,
  attachSignalForwarding,
  resolveBinaryFilename,
  resolveBinaryPath,
  resolveTargetTriple,
  runCliBinary,
} from '../../../bin/curlydots.js';

class FakeChildProcess extends EventEmitter {
  public killed = false;
  public readonly killCalls: string[] = [];

  kill(signal?: string): boolean {
    this.killCalls.push(signal ?? 'UNKNOWN');
    return true;
  }
}

function createProcessRef() {
  const processRef = new EventEmitter() as EventEmitter & {
    env: NodeJS.ProcessEnv;
    off: (event: string, handler: (...args: unknown[]) => void) => EventEmitter;
    on: (event: string, handler: (...args: unknown[]) => void) => EventEmitter;
  };

  processRef.env = {
    PATH: '/usr/bin',
  };

  return processRef;
}

describe('distribution/launcher', () => {
  it('maps supported platform and architecture combinations to target triples', () => {
    expect(resolveTargetTriple('linux', 'x64')).toBe('x86_64-unknown-linux-musl');
    expect(resolveTargetTriple('linux', 'arm64')).toBe('aarch64-unknown-linux-musl');
    expect(resolveTargetTriple('darwin', 'x64')).toBe('x86_64-apple-darwin');
    expect(resolveTargetTriple('darwin', 'arm64')).toBe('aarch64-apple-darwin');
    expect(resolveTargetTriple('win32', 'x64')).toBe('x86_64-pc-windows-msvc');
  });

  it('throws explicit Bun limitation error for Windows ARM64', () => {
    expect(() => resolveTargetTriple('win32', 'arm64')).toThrow(WINDOWS_ARM64_UNSUPPORTED_MESSAGE);
  });

  it('resolves platform-specific binary file names and vendor paths', () => {
    expect(resolveBinaryFilename('x86_64-pc-windows-msvc')).toBe('curlydots.exe');
    expect(resolveBinaryFilename('x86_64-unknown-linux-musl')).toBe('curlydots');

    const binaryPath = resolveBinaryPath({
      vendorRoot: '/tmp/vendor',
      targetTriple: 'x86_64-unknown-linux-musl',
    });

    expect(binaryPath).toBe('/tmp/vendor/x86_64-unknown-linux-musl/curlydots/curlydots');
  });

  it('forwards process signals to child process', () => {
    const processRef = createProcessRef();
    const child = new FakeChildProcess();

    const cleanup = attachSignalForwarding({ processRef, child, signals: ['SIGINT'] });
    processRef.emit('SIGINT');

    expect(child.killCalls).toEqual(['SIGINT']);

    cleanup();
    processRef.emit('SIGINT');

    expect(child.killCalls).toEqual(['SIGINT']);
  });

  it('returns child exit codes from spawned binary', async () => {
    const child = new FakeChildProcess();
    const spawnMock = mock(() => {
      queueMicrotask(() => {
        child.emit('exit', 7, null);
      });
      return child as unknown as ReturnType<typeof import('node:child_process').spawn>;
    });

    const processRef = createProcessRef();
    const result = await runCliBinary({
      argv: ['--help'],
      platform: 'linux',
      arch: 'x64',
      moduleDir: '/tmp/module/bin',
      env: processRef.env,
      processRef: processRef as unknown as NodeJS.Process,
      spawnImpl: spawnMock as unknown as typeof import('node:child_process').spawn,
      existsImpl: () => true,
    });

    expect(result).toEqual({ code: 7, signal: null });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('forwards SIGTERM during runtime and still exits cleanly', async () => {
    const processRef = createProcessRef();
    const child = new FakeChildProcess();

    const spawnMock = mock(() => {
      queueMicrotask(() => {
        processRef.emit('SIGTERM');
        child.emit('exit', 0, null);
      });
      return child as unknown as ReturnType<typeof import('node:child_process').spawn>;
    });

    const result = await runCliBinary({
      argv: [],
      platform: 'linux',
      arch: 'x64',
      moduleDir: '/tmp/module/bin',
      env: processRef.env,
      processRef: processRef as unknown as NodeJS.Process,
      spawnImpl: spawnMock as unknown as typeof import('node:child_process').spawn,
      existsImpl: () => true,
    });

    expect(child.killCalls).toContain('SIGTERM');
    expect(result).toEqual({ code: 0, signal: null });
  });
});
