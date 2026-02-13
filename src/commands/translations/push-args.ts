import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getAvailableParsers, getParser } from '../../parsers';

export interface PushArgs {
  projectUuid?: string;
  repoPath: string;
  translationsDirs: string[];
  source: string;
  parser: string;
  parserFile?: string;
  extensions: string[];
  apiHost: string;
  apiToken?: string;
  batchSize: number;
  help: boolean;
}


// When empty, include all file extensions during context search.
const includeExtensions: string[] = [];

export function parsePushArgs(args: string[]): PushArgs {
  const result: PushArgs = {
    projectUuid: '',
    repoPath: '',
    translationsDirs: [],
    source: '',
    parser: 'node-module',
    parserFile: undefined,
    extensions: [...includeExtensions],
    apiHost: 'https://curlydots.com',
    apiToken: undefined,
    batchSize: 100,
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '--project') {
      result.projectUuid = args[++i] || '';
    } else if (arg === '--repo') {
      result.repoPath = args[++i] || '';
    } else if (arg === '-d' || arg === '--translations-dir') {
      const val = args[++i] || '';
      if (val) result.translationsDirs.push(val);
    } else if (arg === '-s' || arg === '--source') {
      result.source = args[++i] || '';
    } else if (arg === '-p' || arg === '--parser') {
      result.parser = args[++i] || 'node-module';
    } else if (arg === '--parser-file') {
      result.parserFile = args[++i] || '';
    } else if (arg?.startsWith('--parser-file=')) {
      result.parserFile = arg.slice('--parser-file='.length);
    } else if (arg === '-e' || arg === '--extensions') {
      const extString = args[++i] || '';
      result.extensions = extString.split(',').map((ext) => ext.trim()).filter(Boolean);
    } else if (arg === '--api-host') {
      result.apiHost = args[++i] || result.apiHost;
    } else if (arg === '--api-token') {
      result.apiToken = args[++i] || '';
    } else if (arg === '--batch-size') {
      result.batchSize = Number.parseInt(args[++i] || '100', 10);
    }
    i += 1;
  }

  return result;
}

export function validatePushArgs(args: PushArgs): string[] {
  const errors: string[] = [];

  if (!args.repoPath) {
    errors.push('Missing required option: --repo');
  } else {
    const resolvedPath = resolve(args.repoPath);
    if (!existsSync(resolvedPath)) {
      errors.push(`Repository path does not exist: ${resolvedPath}`);
    }
  }

  if (!args.source) {
    errors.push('Missing required option: --source');
  }

  if (args.translationsDirs.length === 0) {
    errors.push('Missing required option: --translations-dir');
  } else if (args.repoPath) {
    for (const dir of args.translationsDirs) {
      // Skip glob patterns — they'll be resolved at runtime
      if (dir.includes('*')) continue;
      const translationsPath = join(resolve(args.repoPath), dir);
      if (!existsSync(translationsPath)) {
        errors.push(`Translations directory not found: ${translationsPath}`);
      }
    }
  }

  if (args.parserFile !== undefined) {
    if (!args.parserFile.trim()) {
      errors.push('Missing required value for --parser-file');
    } else {
      const resolvedParserFile = resolve(args.parserFile);
      if (!existsSync(resolvedParserFile)) {
        errors.push(`Parser file not found: ${resolvedParserFile}`);
      }
    }
  } else if (!getParser(args.parser)) {
    errors.push(`Unknown parser: ${args.parser} (available: ${getAvailableParsers().join(', ')})`);
  }

  if (!Number.isFinite(args.batchSize) || args.batchSize <= 0) {
    errors.push('Batch size must be a positive integer');
  }

  return errors;
}

export function printPushHelp(): void {
  console.log(`
curlydots translations push - Upload missing translation keys

USAGE:
  curlydots translations push [options]

OPTIONS:
  --project <uuid>               Project UUID (optional, falls back to selected project)
  --repo <path>                  Repository path (required)
  -d, --translations-dir <path>  Translations directory (required, repeatable, supports globs)
  -s, --source <lang>            Source language code (required)
  -p, --parser <name>            Parser to use [default: node-module]
  --parser-file <path>           Load parser module from file (.js/.ts)
  -e, --extensions <list>        File extensions to search [default: all files]
  --api-host <url>               API host [default: https://curlydots.com]
  --api-token <token>            API token override
  --batch-size <n>               Upload batch size [default: 100]
  -h, --help                     Show this help message

PARSERS:
  ${getAvailableParsers().join(', ') || 'node-module'}
`);
}
