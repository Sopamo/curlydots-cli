import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadParserFromFile } from '../../../src/parsers/parser-file-loader';

describe('parser-file-loader', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'curlydots-parser-loader-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('loads parser from TypeScript default export', async () => {
    const parserFilePath = join(tempDir, 'custom-parser.ts');
    await writeFile(
      parserFilePath,
      `
export default {
  name: 'ts-custom-parser',
  async export() {
    return new Map([['custom.key', 'Value from TS']]);
  },
  async import() {
    return { filesCreated: 0, filesModified: 0, keysWritten: 0 };
  },
};
`,
      'utf8',
    );

    const parser = await loadParserFromFile(parserFilePath);
    expect(parser.name).toBe('ts-custom-parser');

    const exported = await parser.export('/unused');
    expect(exported.get('custom.key')).toBe('Value from TS');
  });

  it('loads parser from JavaScript named export', async () => {
    const parserFilePath = join(tempDir, 'custom-parser.js');
    await writeFile(
      parserFilePath,
      `
export const parser = {
  name: 'js-custom-parser',
  async export() {
    return new Map([['custom.key', 'Value from JS']]);
  },
  async import() {
    return { filesCreated: 0, filesModified: 0, keysWritten: 0 };
  },
};
`,
      'utf8',
    );

    const parser = await loadParserFromFile(parserFilePath);
    expect(parser.name).toBe('js-custom-parser');

    const exported = await parser.export('/unused');
    expect(exported.get('custom.key')).toBe('Value from JS');
  });

  it('throws when parser file does not implement required parser shape', async () => {
    const parserFilePath = join(tempDir, 'invalid-parser.ts');
    await writeFile(parserFilePath, `export default { name: 'invalid' };`, 'utf8');

    await expect(async () => {
      await loadParserFromFile(parserFilePath);
    }).toThrow('must export a parser with name/export/import functions');
  });
});
