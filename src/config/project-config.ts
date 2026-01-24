import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.curlydots');
const PROJECT_CONFIG_PATH = join(CONFIG_DIR, 'current-project.json');

interface ProjectConfig {
  projectId: string;
  projectName: string;
  teamName: string;
}

export function getCurrentProject(): ProjectConfig | null {
  try {
    if (!existsSync(PROJECT_CONFIG_PATH)) {
      return null;
    }
    const content = readFileSync(PROJECT_CONFIG_PATH, 'utf8');
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

export function setCurrentProject(projectId: string, projectName: string, teamName: string): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const config: ProjectConfig = { projectId, projectName, teamName };
    writeFileSync(PROJECT_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save project selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function clearCurrentProject(): void {
  try {
    if (existsSync(PROJECT_CONFIG_PATH)) {
      writeFileSync(PROJECT_CONFIG_PATH, JSON.stringify(null), 'utf8');
    }
  } catch {
    // Ignore errors when clearing
  }
}
