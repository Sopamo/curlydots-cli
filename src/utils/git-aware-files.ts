import { spawn, spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
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
async function runGit(
  args: string[],
  input?: string,
): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const process = spawn('git', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    process.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stderr.resume();
    process.on('error', reject);
    process.stdin.on('error', reject);
    process.on('close', (status) =>
      resolve({ status, stdout: Buffer.concat(chunks).toString('utf8') }),
    );
    process.stdin.end(input);
  });
}

async function filterIgnoredPaths(
  gitRoot: string,
  repoRelativePaths: string[],
): Promise<Set<string>> {
  if (repoRelativePaths.length === 0) {
    return new Set();
  }

  const ignoredResult = await runGit(
    ['-C', gitRoot, 'check-ignore', '--no-index', '-z', '--stdin'],
    `${repoRelativePaths.join('\0')}\0`,
  );

  if (ignoredResult.status !== 0 && ignoredResult.status !== 1) {
    throw new Error('Unable to check Git ignore rules.');
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
    const canonicalSearchDir = realpathSync(searchDir);
    const relativeSearchDir = relative(gitRoot, canonicalSearchDir);
    // Ask Git for tracked files and untracked-but-not-ignored files within the
    // requested subtree, then let filterIgnoredPaths enforce ignore rules again.
    const args = ['-C', gitRoot, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'];

    if (relativeSearchDir && relativeSearchDir !== '.') {
      args.push('--', relativeSearchDir);
    }

    const filesResult = await runGit(args);

    if (filesResult.status === 0) {
      const repoRelativePaths = filesResult.stdout.split('\0').filter(Boolean);

      const ignoredPaths = await filterIgnoredPaths(gitRoot, repoRelativePaths);

      return repoRelativePaths
        .filter((filePath) => !ignoredPaths.has(filePath))
        .map((filePath) => join(gitRoot, filePath))
        .filter((absolutePath) => includeFile(relative(canonicalSearchDir, absolutePath)));
    }

    throw new Error('Unable to list files from Git.');
  }

  // Outside a Git repository we cannot ask Git which paths are ignored, so the
  // best fallback is a plain filesystem scan filtered only by includeFile.
  const files: string[] = [];
  const glob = new Glob('**/*');

  for await (const relativePath of glob.scan({
    cwd: searchDir,
    absolute: false,
    onlyFiles: true,
  })) {
    if (includeFile(relativePath)) {
      files.push(join(searchDir, relativePath));
    }
  }

  return files;
}
