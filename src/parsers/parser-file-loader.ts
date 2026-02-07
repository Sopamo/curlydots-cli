import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Parser } from '../types';

interface ParserModule {
  default?: unknown;
  parser?: unknown;
}

function isParser(value: unknown): value is Parser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    typeof candidate.export === 'function' &&
    typeof candidate.import === 'function'
  );
}

export async function loadParserFromFile(filePath: string): Promise<Parser> {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Parser file not found: ${absolutePath}`);
  }

  const stats = await stat(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`Parser file path is not a file: ${absolutePath}`);
  }

  let moduleExports: ParserModule;
  try {
    const fileUrl = pathToFileURL(absolutePath).href;
    moduleExports = (await import(fileUrl)) as ParserModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load parser file ${absolutePath}: ${message}`);
  }

  const parserCandidate = moduleExports.default ?? moduleExports.parser;
  if (!isParser(parserCandidate)) {
    throw new Error(
      `Parser file ${absolutePath} must export a parser with name/export/import functions`,
    );
  }

  return parserCandidate;
}
