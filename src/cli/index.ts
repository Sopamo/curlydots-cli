import { runExtract } from '../commands/extract';
import { importCommand } from '../commands/import';
import { translateCommand } from '../commands/translate';
import { projectsCommand } from '../commands/projects';
import { authLoginCommand } from '../commands/auth/login';
import { authLogoutCommand } from '../commands/auth/logout';
import { authStatusCommand } from '../commands/auth/status';
import { globalLogger } from '../utils/logger';
import packageJson from '../../package.json' with { type: 'json' };

export type CommandHandler = (args: string[]) => Promise<void>;

const commandMap: Record<string, CommandHandler> = {
  extract: async (args) => runExtract(args),
  translate: async (args) => translateCommand(args),
  import: async (args) => importCommand(args),
  projects: async (args) => projectsCommand(args),
  'auth login': async (args) => authLoginCommand(args),
  'auth logout': async (args) => authLogoutCommand(args),
  'auth status': async (args) => authStatusCommand(args),
};

function normalizeCommand(args: string[]): { key: string; rest: string[] } {
  const [first, second, ...rest] = args;
  if (!first) {
    return { key: '', rest: [] };
  }

  const combined = second ? `${first} ${second}` : first;
  if (commandMap[combined]) {
    return { key: combined, rest };
  }

  return { key: first, rest: [second, ...rest].filter((part): part is string => Boolean(part)) };
}

function printHelp() {
  globalLogger.info(`
Curlydots CLI

Usage:
  curlydots <command> [options]

Commands:
  auth login             Authenticate via browser
  auth logout            Remove stored credentials locally
  auth status            Display stored authentication info
  projects               List available projects
  translations push      Push translation payload to backend
  translations status    Check translation push status
  extract                Find missing translations
  translate              Translate CSV using AI
  import                 Import translated CSV
`);
}

function printVersion() {
  console.log(`curlydots CLI v${packageJson.version}`);
}

export async function runCli(argv: string[]): Promise<void> {
  const [firstArg] = argv;

  if (!firstArg || firstArg === '-h' || firstArg === '--help') {
    printHelp();
    return;
  }

  if (firstArg === '-v' || firstArg === '--version') {
    printVersion();
    return;
  }

  const { key, rest } = normalizeCommand(argv);
  const handler = commandMap[key];

  if (!handler) {
    globalLogger.error(`Unknown command: ${key || firstArg}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  await handler(rest);
}
