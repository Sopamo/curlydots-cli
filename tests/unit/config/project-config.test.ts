import { afterEach, describe, expect, it, mock } from 'bun:test';
import { join } from 'node:path';

let moduleNonce = 0;

function importFreshProjectConfigModule() {
  moduleNonce += 1;
  return import(`../../../src/config/project-config.ts?test=${moduleNonce}`);
}

describe('config/project-config', () => {
  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
  });

  it('prefers a project-local current-project override over the global selection', async () => {
    const cwd = process.cwd();
    const projectGitMarker = join(cwd, '.git');
    const localPath = join(cwd, '.curlydots', 'current-project.json');
    const globalPath = '/home/test/.curlydots/current-project.json';

    const existsSyncMock = mock((filePath: string) => (
      filePath === projectGitMarker || filePath === localPath || filePath === globalPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === localPath) {
        return JSON.stringify({
          projectId: 'local-project',
          projectName: 'Local Project',
          teamName: 'Local Team',
        });
      }

      if (filePath === globalPath) {
        return JSON.stringify({
          projectId: 'global-project',
          projectName: 'Global Project',
          teamName: 'Global Team',
        });
      }

      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
      writeFileSync: mock(() => undefined),
      mkdirSync: mock(() => undefined),
    }));

    const { getCurrentProject } = await importFreshProjectConfigModule();
    const project = getCurrentProject();

    expect(project?.projectId).toBe('local-project');
    expect(readFileSyncMock).toHaveBeenCalledWith(localPath, 'utf8');
    expect(readFileSyncMock.mock.calls.some(([filePath]) => filePath === globalPath)).toBe(false);
  });

  it('falls back to the global selection when no project-local override exists', async () => {
    const cwd = process.cwd();
    const projectGitMarker = join(cwd, '.git');
    const localPath = join(cwd, '.curlydots', 'current-project.json');
    const globalPath = '/home/test/.curlydots/current-project.json';

    const existsSyncMock = mock((filePath: string) => (
      filePath === projectGitMarker || filePath === globalPath
    ));
    const readFileSyncMock = mock((filePath: string) => {
      if (filePath === globalPath) {
        return JSON.stringify({
          projectId: 'global-project',
          projectName: 'Global Project',
          teamName: 'Global Team',
        });
      }

      throw new Error(`Unexpected read: ${filePath}`);
    });

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
      writeFileSync: mock(() => undefined),
      mkdirSync: mock(() => undefined),
    }));

    const { getCurrentProject } = await importFreshProjectConfigModule();
    const project = getCurrentProject();

    expect(project?.projectId).toBe('global-project');
    expect(readFileSyncMock).toHaveBeenCalledWith(globalPath, 'utf8');
    expect(readFileSyncMock.mock.calls.some(([filePath]) => filePath === localPath)).toBe(false);
  });

  it('writes project selection to local override when a local .curlydots directory exists', async () => {
    const cwd = process.cwd();
    const projectGitMarker = join(cwd, '.git');
    const localDir = join(cwd, '.curlydots');
    const localPath = join(localDir, 'current-project.json');
    const writeFileSyncMock = mock(() => undefined);
    const mkdirSyncMock = mock(() => undefined);
    const existsSyncMock = mock((filePath: string) => (
      filePath === projectGitMarker || filePath === localDir
    ));

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: mock(() => '{}'),
      writeFileSync: writeFileSyncMock,
      mkdirSync: mkdirSyncMock,
    }));

    const { setCurrentProject } = await importFreshProjectConfigModule();
    setCurrentProject('project-1', 'Project One', 'Team One');

    expect(mkdirSyncMock).toHaveBeenCalledWith(localDir, { recursive: true });
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      localPath,
      JSON.stringify({
        projectId: 'project-1',
        projectName: 'Project One',
        teamName: 'Team One',
      }, null, 2),
      'utf8',
    );
  });

  it('writes project selection to global config when no local override is configured', async () => {
    const cwd = process.cwd();
    const projectGitMarker = join(cwd, '.git');
    const globalDir = '/home/test/.curlydots';
    const globalPath = '/home/test/.curlydots/current-project.json';
    const writeFileSyncMock = mock(() => undefined);
    const mkdirSyncMock = mock(() => undefined);
    const existsSyncMock = mock((filePath: string) => filePath === projectGitMarker);

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: mock(() => '{}'),
      writeFileSync: writeFileSyncMock,
      mkdirSync: mkdirSyncMock,
    }));

    const { setCurrentProject } = await importFreshProjectConfigModule();
    setCurrentProject('project-2', 'Project Two', 'Team Two');

    expect(mkdirSyncMock).toHaveBeenCalledWith(globalDir, { recursive: true });
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      globalPath,
      JSON.stringify({
        projectId: 'project-2',
        projectName: 'Project Two',
        teamName: 'Team Two',
      }, null, 2),
      'utf8',
    );
  });

  it('clears the local override when it exists', async () => {
    const cwd = process.cwd();
    const projectGitMarker = join(cwd, '.git');
    const localPath = join(cwd, '.curlydots', 'current-project.json');
    const writeFileSyncMock = mock(() => undefined);
    const existsSyncMock = mock((filePath: string) => (
      filePath === projectGitMarker || filePath === localPath
    ));

    mock.module('node:os', () => ({
      homedir: () => '/home/test',
    }));

    mock.module('node:fs', () => ({
      existsSync: existsSyncMock,
      readFileSync: mock(() => '{}'),
      writeFileSync: writeFileSyncMock,
      mkdirSync: mock(() => undefined),
    }));

    const { clearCurrentProject } = await importFreshProjectConfigModule();
    clearCurrentProject();

    expect(writeFileSyncMock).toHaveBeenCalledWith(localPath, 'null', 'utf8');
  });
});
