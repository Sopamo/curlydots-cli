import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { platform } from './node-platform';

const CONFIG_DIR_NAME = '.curlydots';

export function getGlobalCurlydotsFilePath(fileName: string): string {
  return join(platform.homedir(), CONFIG_DIR_NAME, fileName);
}

/**
 * Finds the lowest shared directory that contains every resolved path in the input.
 *
 * Business logic: commands that operate on multiple translation directories need one consistent
 * project-local config scope. We use the common ancestor as that scope so `current-project.json`,
 * `config.json`, and `auth.json` are all resolved from a single location that represents the whole
 * set of inputs, instead of letting whichever translation directory or shell cwd happens to be first
 * decide the config source.
 */
export function findCommonAncestorDirectory(paths: string[]): string | undefined {
  if (paths.length === 0) {
    return undefined;
  }

  const resolvedPaths = paths.map((filePath) => resolve(filePath));
  const [firstResolvedPath] = resolvedPaths;
  if (!firstResolvedPath) {
    return undefined;
  }
  let commonAncestor = firstResolvedPath;

  for (const currentPath of resolvedPaths.slice(1)) {
    if (parse(commonAncestor).root !== parse(currentPath).root) {
      return undefined;
    }

    while (true) {
      const relativePath = relative(commonAncestor, currentPath);

      if (relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))) {
        break;
      }

      const parentDir = dirname(commonAncestor);
      if (parentDir === commonAncestor) {
        break;
      }

      commonAncestor = parentDir;
    }
  }

  return commonAncestor;
}

function findProjectSearchBoundary(startDir: string): string {
  let currentDir = resolve(startDir);

  while (true) {
    // Support both .git directories and .git files (worktrees/submodules).
    if (platform.existsSync(join(currentDir, '.git'))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // No project marker found: do not search outside the current working directory.
      return startDir;
    }
    currentDir = parentDir;
  }
}

/**
 * Finds the nearest project-local config file, such as `.curlydots/current-project.json`, starting
 * from an explicit base directory.
 *
 * Business logic: callers use this when config lookup should follow the resolved work being acted on,
 * not the user's shell cwd. For example, `translations push` resolves translation directories first,
 * computes their common ancestor, and then uses that shared ancestor as the starting point for
 * `current-project.json`, `config.json`, or `auth.json` lookup. This helper intentionally walks all
 * the way to the filesystem root instead of stopping at a git boundary because the chosen base
 * directory already represents the scope that the command should honor .
 */
export function findNearestCurlydotsFilePathFrom(
  fileName: string,
  startDir: string,
): string | undefined {
  let currentDir = resolve(startDir);

  while (true) {
    const candidate = join(currentDir, CONFIG_DIR_NAME, fileName);
    if (platform.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }

    currentDir = parentDir;
  }
}

export function findNearestProjectCurlydotsFilePath(
  fileName: string,
  startDir = process.cwd(),
): string | undefined {
  const boundaryDir = findProjectSearchBoundary(startDir);
  let currentDir = resolve(startDir);

  while (true) {
    const candidate = join(currentDir, CONFIG_DIR_NAME, fileName);
    if (platform.existsSync(candidate)) {
      return candidate;
    }

    if (currentDir === boundaryDir) {
      return undefined;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
}

export function parseJsonObjectFile(filePath: string): Record<string, unknown> {
  try {
    const content = platform.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    if (typeof data === 'object' && data !== null) {
      return data as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function writeJsonObjectFile(filePath: string, value: Record<string, unknown>): void {
  try {
    platform.mkdirSync(dirname(filePath), { recursive: true });
    platform.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } catch {
    // Ignore file write failures and continue with defaults/in-memory config.
  }
}

export function readSchemaVersion(config: Record<string, unknown>): number {
  const candidate = config.schemaVersion;
  if (typeof candidate !== 'number') {
    return 0;
  }

  if (!Number.isInteger(candidate) || candidate < 0) {
    return 0;
  }

  return candidate;
}

function writeJsonTemplateIfMissing(filePath: string, template: Record<string, unknown>): void {
  if (platform.existsSync(filePath)) {
    return;
  }

  writeJsonObjectFile(filePath, template);
}

export function ensureGlobalCurlydotsConfigFiles(): void {
  writeJsonTemplateIfMissing(getGlobalCurlydotsFilePath('config.json'), {
    schemaVersion: 1,
    apiEndpoint: 'https://curlydots.com/api',
    frontendUrl: 'https://curlydots.com',
    debug: false,
  });

  writeJsonTemplateIfMissing(getGlobalCurlydotsFilePath('auth.json'), {
    schemaVersion: 1,
    authMethod: 'browser',
    tokenStorage: 'keychain',
  });
}
