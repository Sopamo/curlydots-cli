import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { getAvailableParsers, getParser } from '../../parsers';

export interface SyncArgs {
  teamSlug: string;
  projectSlug: string;
  repoPath: string;
  translationsDir: string;
  source: string;
  parser: string;
  parserFile?: string;
  extensions: string[];
  apiHost: string;
  apiToken?: string;
  idempotencyKey?: string;
  help: boolean;
}

export function parseSyncArgs(args: string[]): SyncArgs {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      team: { type: 'string' },
      project: { type: 'string' },
      repo: { type: 'string' },
      'translations-dir': { type: 'string', short: 'd' },
      source: { type: 'string', short: 's' },
      parser: { type: 'string', short: 'p', default: 'node-module' },
      'parser-file': { type: 'string' },
      extensions: { type: 'string', short: 'e' },
      'api-host': { type: 'string' },
      'api-token': { type: 'string' },
      'idempotency-key': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  return {
    teamSlug: values.team ?? '',
    projectSlug: values.project ?? '',
    repoPath: values.repo ?? '',
    translationsDir: values['translations-dir'] ?? '',
    source: values.source ?? '',
    parser: values.parser || 'node-module',
    parserFile: values['parser-file'],
    extensions: (values.extensions ?? '')
      .split(',')
      .map((ext) => ext.trim())
      .filter(Boolean),
    apiHost: values['api-host'] ?? '',
    apiToken: values['api-token'],
    idempotencyKey: values['idempotency-key'],
    help: values.help ?? false,
  };
}

export function validateSyncArgs(args: SyncArgs): string[] {
  const errors: string[] = [];

  if (!args.teamSlug) {
    errors.push('Missing required option: --team');
  }

  if (!args.projectSlug) {
    errors.push('Missing required option: --project');
  }

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

  if (!args.translationsDir) {
    errors.push('Missing required option: --translations-dir');
  } else if (args.repoPath) {
    const translationsPath = join(resolve(args.repoPath), args.translationsDir);
    if (!existsSync(translationsPath)) {
      errors.push(`Translations directory not found: ${translationsPath}`);
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

  if (args.idempotencyKey !== undefined) {
    const idempotencyKey = args.idempotencyKey.trim();
    if (!idempotencyKey) {
      errors.push('Missing required value for --idempotency-key');
    } else if (idempotencyKey.length > 255) {
      errors.push('Idempotency key must not exceed 255 characters');
    }
  }

  return errors;
}

export function printSyncHelp(): void {
  console.log(`
curlydots translations sync - Sync default-language translation keys with Curlydots

USAGE:
  curlydots translations sync [options]

OPTIONS:
  --team <slug>                  Team slug (required)
  --project <slug>               Project slug (required)
  --repo <path>                  Repository path (required)
  -d, --translations-dir <path>  Translations directory (required)
  -s, --source <lang>            Source language code (required)
  -p, --parser <name>            Parser to use [default: node-module]
  --parser-file <path>           Load parser module from file (.js/.ts)
  -e, --extensions <list>        File extensions to search [default: all files]
  --api-host <url>               API host [default: CLI config]
  --api-token <token>            API token override
  --idempotency-key <key>        Stable key for safely retrying the sync request
  -h, --help                     Show this help message

PARSERS:
  ${getAvailableParsers().join(', ') || 'node-module'}
`);
}
