import { mock } from 'bun:test';

export interface CliTestContext {
  stdout: string[];
  stderr: string[];
}

export function createCliTestContext(): CliTestContext {
  const stdout: string[] = [];
  const stderr: string[] = [];

  mock.module('node:process', () => ({
    stdout: {
      write: (value: string) => {
        stdout.push(value);
        return true;
      },
    },
    stderr: {
      write: (value: string) => {
        stderr.push(value);
        return true;
      },
    },
  }));

  return { stdout, stderr };
}
