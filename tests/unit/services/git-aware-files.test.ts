import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { listFilesRespectingGitIgnore } from '../../../src/utils/git-aware-files';

test('file discovery respects tracked and untracked ignores through a directory symlink', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'curlydots-git-alias-')));
  const repository = join(directory, 'repository');
  const alias = join(directory, 'alias');

  try {
    await mkdir(join(repository, 'src'), { recursive: true });
    execFileSync('git', ['init', '-q', repository]);
    await writeFile(join(repository, '.gitignore'), 'src/ignored.ts\nsrc/tracked-ignored.ts\n');
    await writeFile(join(repository, 'src/visible.ts'), 'export const visible = true;');
    await writeFile(join(repository, 'src/ignored.ts'), 'export const ignored = true;');
    await writeFile(join(repository, 'src/tracked-ignored.ts'), 'export const ignored = true;');
    execFileSync('git', ['-C', repository, 'add', '-f', 'src/tracked-ignored.ts']);
    await symlink(repository, alias, 'junction');

    const scannedPaths: string[] = [];
    const files = await listFilesRespectingGitIgnore(join(alias, 'src'), (path) => {
      scannedPaths.push(path);
      return path.endsWith('.ts');
    });

    expect(files.map((path) => basename(path))).toEqual(['visible.ts']);
    expect(scannedPaths).toEqual(['visible.ts']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('large Git listings keep ignore filtering beyond the default process buffer', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'curlydots-git-large-')));
  try {
    execFileSync('git', ['init', '-q', directory]);
    const hash = execFileSync('git', ['-C', directory, 'hash-object', '-w', '--stdin'], {
      input: 'content',
      encoding: 'utf8',
    }).trim();
    const paths = Array.from(
      { length: 7000 },
      (_, index) => `ignored/${index}_${'a'.repeat(170)}.ts`,
    );
    const indexInput = paths.map((path) => `100644 ${hash}\t${path}\n`).join('');
    execFileSync('git', ['-C', directory, 'update-index', '--index-info'], { input: indexInput });
    await writeFile(join(directory, '.gitignore'), 'ignored/\n');
    await writeFile(join(directory, 'visible.ts'), 'visible');
    const files = await listFilesRespectingGitIgnore(directory, (path) => path.endsWith('.ts'));
    expect(files.map((path) => basename(path))).toEqual(['visible.ts']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
