import { HttpClient, HttpClientError } from '../services/http/client.js';
import { loadAuthToken } from '../services/auth/token-manager.js';
import { globalLogger } from '../utils/logger.js';
import { loadCliConfig } from '../config/cli-config.js';
import { clearCurrentProject, getCurrentProject, setCurrentProject } from '../config/project-config.js';
import * as readline from 'node:readline';
import chalk from 'chalk';

interface Project {
  id: string;
  name: string;
  slug: string;
  team: {
    id: number;
    name: string;
  };
}

interface ProjectsResponse {
  data: Project[];
}

export function printProjectsHelp(): void {
  console.log(`
curlydots projects select - Manage your current project selection

Usage:
  curlydots projects select [options]

Description:
  Lists all projects available to your authenticated user and lets you pick
  which one should be active for subsequent commands.

Options:
  -h, --help    Show this help message

Notes:
  • Requires authentication (run "curlydots auth login" first)
  • Stores the selected project locally so future runs remember it
`);
}

async function promptForSelection(projects: Project[]): Promise<Project | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = chalk.cyan('\n→ Select a project (enter number or press Enter to cancel): ');
    rl.question(prompt, (answer) => {
      rl.close();
      
      const selection = parseInt(answer.trim(), 10);
      if (isNaN(selection) || selection < 1 || selection > projects.length) {
        resolve(null);
        return;
      }
      
      const selected = projects[selection - 1];
      resolve(selected ?? null);
    });
  });
}

export async function projectsCommand(_args: string[]): Promise<void> {
  try {
    const token = await loadAuthToken();
    if (!token) {
      globalLogger.error('Not authenticated. Run "curlydots auth login" first.');
      process.exitCode = 1;
      return;
    }

    const config = loadCliConfig();
    const client = HttpClient.fromConfig(config);

    const response = await client.get<ProjectsResponse>('cli/projects', {
      token: token.accessToken,
    });

    if (!response.data || response.data.length === 0) {
      globalLogger.info('No projects available.');
      return;
    }

    const storedProject = getCurrentProject();
    const hasApiKey = !!config.token;
    const projectIds = new Set(response.data.map((project) => project.id));
    let currentProject = storedProject;

    if (storedProject && !projectIds.has(storedProject.projectId)) {
      clearCurrentProject();
      currentProject = null;
      globalLogger.warn('Your current project selection is no longer available. Please select a new project.');
    }
    
    console.log(chalk.bold('\nAvailable Projects:\n'));
    
    if (response.data.length === 1 && hasApiKey) {
      console.log(chalk.yellow('⚠ You are using an API key which only has access to one project.'));
      console.log(chalk.yellow(' Remove the API key and run "curlydots auth login" to be able to switch between all your projects.\n'));
    }
    
    response.data.forEach((project, index) => {
      const isCurrent = currentProject?.projectId === project.id;
      const marker = isCurrent ? chalk.green('● ') : '  ';
      const number = chalk.cyan(`${index + 1}.`);
      const name = isCurrent ? chalk.green.bold(project.name) : chalk.bold(project.name);
      
      console.log(marker + number + ' ' + name);
      console.log(chalk.dim(`     ${project.team.name}`));
      console.log(chalk.gray(`     ${project.id}`));
      console.log();
    });

    const selected = await promptForSelection(response.data);
    
    if (selected) {
      setCurrentProject(selected.id, selected.name, selected.team.name);
      console.log(chalk.green('✓') + chalk.bold(` Selected: ${selected.name}`));
      console.log(chalk.dim(`  Team: ${selected.team.name}`));
      console.log(chalk.dim(`  ID: ${selected.id}`));
    } else {
      globalLogger.info('Selection cancelled.');
    }
  } catch (error) {
    if (error instanceof HttpClientError && error.meta.status === 401) {
      globalLogger.warn('You are not authenticated. Run "curlydots auth login" and try again.');
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    globalLogger.error(`Failed to fetch projects: ${message}`);
    process.exitCode = 1;
  }
}
