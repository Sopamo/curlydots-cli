import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const CONFIG_DIR_NAME = '.curlydots';

export function getGlobalCurlydotsFilePath(fileName: string): string {
  return join(homedir(), CONFIG_DIR_NAME, fileName);
}

function findProjectSearchBoundary(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    // Support both .git directories and .git files (worktrees/submodules).
    if (existsSync(join(currentDir, '.git'))) {
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

export function findNearestProjectCurlydotsFilePath(fileName: string): string | undefined {
  const startDir = process.cwd();
  const boundaryDir = findProjectSearchBoundary(startDir);
  let currentDir = startDir;

  while (true) {
    const candidate = join(currentDir, CONFIG_DIR_NAME, fileName);
    if (existsSync(candidate)) {
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
    const content = readFileSync(filePath, 'utf8');
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
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
  if (existsSync(filePath)) {
    return;
  }

  writeJsonObjectFile(filePath, template);
}

export function ensureGlobalCurlydotsConfigFiles(): void {
  writeJsonTemplateIfMissing(
    getGlobalCurlydotsFilePath('config.json'),
    {
      schemaVersion: 1,
      apiEndpoint: 'https://curlydots.com/api',
      debug: false,
    },
  );

  writeJsonTemplateIfMissing(
    getGlobalCurlydotsFilePath('auth.json'),
    {
      schemaVersion: 1,
      authMethod: 'browser',
      tokenStorage: 'keychain',
    },
  );
}
