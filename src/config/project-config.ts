import { dirname, join } from 'node:path';
import { platform } from './node-platform';

const CONFIG_DIR_NAME = '.curlydots';
const PROJECT_CONFIG_FILE_NAME = 'current-project.json';
const GLOBAL_CONFIG_DIR = join(platform.homedir(), CONFIG_DIR_NAME);
const GLOBAL_PROJECT_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, PROJECT_CONFIG_FILE_NAME);

interface ProjectConfig {
  projectId: string;
  projectName: string;
  teamName: string;
}

function findProjectRoot(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    if (platform.existsSync(join(currentDir, '.git'))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function getLocalProjectConfigPath(): string | null {
  const projectRoot = findProjectRoot(process.cwd());
  if (!projectRoot) {
    return null;
  }

  return join(projectRoot, CONFIG_DIR_NAME, PROJECT_CONFIG_FILE_NAME);
}

function isProjectConfig(value: unknown): value is ProjectConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.projectId === 'string' &&
    typeof candidate.projectName === 'string' &&
    typeof candidate.teamName === 'string'
  );
}

function readProjectConfigFromPath(filePath: string): ProjectConfig | null {
  try {
    const content = platform.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;

    if (parsed === null) {
      return null;
    }

    return isProjectConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveReadPath(): string {
  const localPath = getLocalProjectConfigPath();

  if (localPath && platform.existsSync(localPath)) {
    return localPath;
  }

  return GLOBAL_PROJECT_CONFIG_PATH;
}

function resolveWritePath(): string {
  const localPath = getLocalProjectConfigPath();

  if (!localPath) {
    return GLOBAL_PROJECT_CONFIG_PATH;
  }

  const localDir = dirname(localPath);
  if (platform.existsSync(localPath) || platform.existsSync(localDir)) {
    return localPath;
  }

  return GLOBAL_PROJECT_CONFIG_PATH;
}

export function getCurrentProject(): ProjectConfig | null {
  const configPath = resolveReadPath();
  if (!platform.existsSync(configPath)) {
    return null;
  }

  return readProjectConfigFromPath(configPath);
}

export function setCurrentProject(projectId: string, projectName: string, teamName: string): void {
  const configPath = resolveWritePath();

  try {
    platform.mkdirSync(dirname(configPath), { recursive: true });

    const config: ProjectConfig = { projectId, projectName, teamName };
    platform.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to save project selection: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export function clearCurrentProject(): void {
  const configPath = resolveReadPath();

  try {
    if (platform.existsSync(configPath)) {
      platform.writeFileSync(configPath, JSON.stringify(null), 'utf8');
    }
  } catch {
    // Ignore errors when clearing
  }
}
