import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { Glob } from 'bun';

// We prefer Git as the source of truth for file discovery.
function findGitRoot(searchDir: string): string | undefined {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: searchDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return undefined;
  }

  const gitRoot = result.stdout.trim();
  return gitRoot || undefined;
}

// git ls-files can still return tracked files that now match ignore rules, so we
// run git check-ignore as a second pass and remove anything Git considers ignored.
function filterIgnoredPaths(gitRoot: string, repoRelativePaths: string[]): Set<string> {
  if (repoRelativePaths.length === 0) {
    return new Set();
  }

  const ignoredResult = spawnSync(
    'git',
    ['-C', gitRoot, 'check-ignore', '--no-index', '-z', '--stdin'],
    {
      encoding: 'utf8',
      input: repoRelativePaths.join('\0'),
    },
  );

  if (ignoredResult.status !== 0 && ignoredResult.status !== 1) {
    return new Set();
  }

  return new Set(ignoredResult.stdout.split('\0').filter(Boolean));
}

// Returns files under searchDir while honoring Git ignore rules when the path is
// inside a repository. Outside Git, it falls back to plain filesystem scanning.
export async function listFilesRespectingGitIgnore(
  searchDir: string,
  includeFile: (relativePath: string) => boolean,
): Promise<string[]> {
  const gitRoot = findGitRoot(searchDir);

  if (gitRoot) {
    const relativeSearchDir = relative(gitRoot, searchDir);
    // Ask Git for tracked files and untracked-but-not-ignored files within the
    // requested subtree, then let filterIgnoredPaths enforce ignore rules again.
    const args = ['-C', gitRoot, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'];

    if (relativeSearchDir && relativeSearchDir !== '.') {
      args.push('--', relativeSearchDir);
    }

    const filesResult = spawnSync('git', args, {
      encoding: 'utf8',
    });

    if (filesResult.status === 0) {
      const repoRelativePaths = filesResult.stdout
        .split('\0')
        .filter(Boolean);

      const ignoredPaths = filterIgnoredPaths(gitRoot, repoRelativePaths);

      return repoRelativePaths
        .filter((filePath) => !ignoredPaths.has(filePath))
        .map((filePath) => join(gitRoot, filePath))
        .filter((absolutePath) => includeFile(relative(searchDir, absolutePath)));
    }
  }

  // Outside a Git repository we cannot ask Git which paths are ignored, so the
  // best fallback is a plain filesystem scan filtered only by includeFile.
  const files: string[] = [];
  const glob = new Glob('**/*');

  for await (const relativePath of glob.scan({ cwd: searchDir, absolute: false, onlyFiles: true })) {
    if (includeFile(relativePath)) {
      files.push(join(searchDir, relativePath));
    }
  }

  return files;
}
