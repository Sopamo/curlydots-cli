import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  help: boolean;
}

const includeExtensions: string[] = [];

export function parseSyncArgs(args: string[]): SyncArgs {
  const result: SyncArgs = {
    teamSlug: '',
    projectSlug: '',
    repoPath: '',
    translationsDir: '',
    source: '',
    parser: 'node-module',
    parserFile: undefined,
    extensions: [...includeExtensions],
    apiHost: '',
    apiToken: undefined,
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '--team') {
      result.teamSlug = args[++i] || '';
    } else if (arg === '--project') {
      result.projectSlug = args[++i] || '';
    } else if (arg === '--repo') {
      result.repoPath = args[++i] || '';
    } else if (arg === '-d' || arg === '--translations-dir') {
      result.translationsDir = args[++i] || '';
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
      result.extensions = extString
        .split(',')
        .map((ext) => ext.trim())
        .filter(Boolean);
    } else if (arg === '--api-host') {
      result.apiHost = args[++i] || '';
    } else if (arg === '--api-token') {
      result.apiToken = args[++i] || '';
    }
    i += 1;
  }

  return result;
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
  -h, --help                     Show this help message

PARSERS:
  ${getAvailableParsers().join(', ') || 'node-module'}
`);
}
