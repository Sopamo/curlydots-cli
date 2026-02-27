import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type FetchArgs = Parameters<typeof fetch>;

mock.module('../../src/config/cli-config', () => ({
  loadCliConfig: () => ({
    apiEndpoint: 'https://curlydots.com',
    timeout: 500,
    retries: 0,
    debug: false,
    defaultLocale: undefined,
  }),
}));

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function createRepoWithJsonFilesStructure(baseDir: string): Promise<{
  repoPath: string;
  parserFilePath: string;
}> {
  const repoPath = join(baseDir, 'repo-json-files');
  const parserFilePath = join(baseDir, 'json-folder-parser.ts');

  await ensureDir(join(repoPath, 'src'));
  await ensureDir(join(repoPath, 'translations/en'));

  await writeFile(
    join(repoPath, 'src', 'app.ts'),
    `
const used = ['common.greeting', 'common.nested.cta', 'errors.notFound'];
console.log(used);
`,
    'utf8',
  );

  await writeFile(
    join(repoPath, 'translations/en', 'common.json'),
    JSON.stringify(
      {
        greeting: 'Hello',
        nested: {
          cta: 'Save',
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    join(repoPath, 'translations/en', 'errors.json'),
    JSON.stringify(
      {
        notFound: 'Not found',
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    parserFilePath,
    `
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

function flattenObject(obj, prefix = '') {
  const result = new Map();
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? \`\${prefix}.\${key}\` : key;
    if (typeof value === 'string') {
      result.set(next, value);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenObject(value, next);
      for (const [nestedKey, nestedValue] of nested.entries()) {
        result.set(nestedKey, nestedValue);
      }
    }
  }
  return result;
}

export default {
  name: 'json-folder-parser',
  async export(langDir) {
    const entries = new Map();
    const files = await readdir(langDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const content = JSON.parse(await readFile(join(langDir, file), 'utf8'));
      const prefix = basename(file, '.json');
      const flat = flattenObject(content, prefix);
      for (const [key, value] of flat.entries()) {
        entries.set(key, value);
      }
    }
    return entries;
  },
  async import() {
    return { filesCreated: 0, filesModified: 0, keysWritten: 0 };
  },
};
`,
    'utf8',
  );

  return { repoPath, parserFilePath };
}

async function createRepoWithNestedModuleStructure(baseDir: string): Promise<{
  repoPath: string;
  parserFilePath: string;
}> {
  const repoPath = join(baseDir, 'repo-nested-modules');
  const parserFilePath = join(baseDir, 'nested-module-parser.js');

  await ensureDir(join(repoPath, 'app/components'));
  await ensureDir(join(repoPath, 'locale-data/en/screens/auth'));
  await ensureDir(join(repoPath, 'locale-data/en/screens/home'));

  await writeFile(
    join(repoPath, 'app/components', 'Home.tsx'),
    `
export function Home() {
  return <h1>{t('screens.home.title')}</h1>;
}
`,
    'utf8',
  );

  await writeFile(
    join(repoPath, 'app/components', 'Login.tsx'),
    `
export function Login() {
  return <button>{t('screens.auth.login.button')}</button>;
}
`,
    'utf8',
  );

  await writeFile(
    join(repoPath, 'locale-data/en/screens/home', 'index.ts'),
    `
export default {
  title: 'Home',
  subtitle: 'Welcome back',
};
`,
    'utf8',
  );

  await writeFile(
    join(repoPath, 'locale-data/en/screens/auth', 'login.ts'),
    `
export default {
  button: 'Login',
};
`,
    'utf8',
  );

  await writeFile(
    parserFilePath,
    `
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

async function walk(dir) {
  const result = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walk(fullPath)));
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      result.push(fullPath);
    }
  }
  return result;
}

function flattenObject(obj, prefix = '') {
  const out = new Map();
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? \`\${prefix}.\${key}\` : key;
    if (typeof value === 'string') {
      out.set(next, value);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenObject(value, next);
      for (const [nestedKey, nestedValue] of nested.entries()) {
        out.set(nestedKey, nestedValue);
      }
    }
  }
  return out;
}

export default {
  name: 'nested-module-parser',
  async export(langDir) {
    const result = new Map();
    const files = await walk(langDir);

    for (const filePath of files) {
      const relativePath = relative(langDir, filePath).replace(/\\.ts$/, '');
      const modulePrefix = relativePath.split(sep).join('.');
      const module = await import(pathToFileURL(filePath).href);
      const content = module.default ?? {};
      const flat = flattenObject(content, modulePrefix);

      for (const [key, value] of flat.entries()) {
        result.set(key, value);
      }
    }

    return result;
  },
  async import() {
    return { filesCreated: 0, filesModified: 0, keysWritten: 0 };
  },
};
`,
    'utf8',
  );

  return { repoPath, parserFilePath };
}

describe('integration/push-translations parser-file', () => {
  const originalFetch = globalThis.fetch;
  let tempDir = '';
  const fetchCalls: Array<{ input: FetchArgs[0]; init?: FetchArgs[1] }> = [];
  const fetchMock = mock(async (...args: FetchArgs) => {
    const [input, init] = args;
    fetchCalls.push({ input, init });
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      return new Response(JSON.stringify({ keys: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({}), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'curlydots-parser-file-push-'));
    fetchCalls.length = 0;
    fetchMock.mockClear();
    process.exitCode = 0;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.exitCode = 0;
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('loads parser from TypeScript file for JSON folder translation structure', async () => {
    const { runTranslationsPush } = await import('../../src/commands/translations/push');
    const { repoPath, parserFilePath } = await createRepoWithJsonFilesStructure(tempDir);

    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      repoPath,
      '--translations-dir',
      'translations',
      '--source',
      'en',
      `--parser-file=${parserFilePath}`,
      '--api-host',
      'https://curlydots.com/api',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') !== 'GET');
    const body = JSON.parse((postCall?.init?.body as string) ?? '{}') as {
      keys?: Array<{ translationKey: string }>;
    };

    const pushedKeys = (body.keys ?? []).map((item) => item.translationKey).sort();
    expect(pushedKeys).toEqual(['common.greeting', 'common.nested.cta', 'errors.notFound']);
  });

  it('loads parser from JavaScript file for nested module translation structure', async () => {
    const { runTranslationsPush } = await import('../../src/commands/translations/push');
    const { repoPath, parserFilePath } = await createRepoWithNestedModuleStructure(tempDir);

    await runTranslationsPush([
      '--project',
      'project-123',
      '--repo',
      repoPath,
      '--translations-dir',
      'locale-data',
      '--source',
      'en',
      `--parser-file=${parserFilePath}`,
      '--api-host',
      'https://curlydots.com/api',
      '--api-token',
      'token-abc',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postCall = fetchCalls.find((call) => (call.init?.method ?? 'GET') !== 'GET');
    const body = JSON.parse((postCall?.init?.body as string) ?? '{}') as {
      keys?: Array<{ translationKey: string }>;
    };

    const pushedKeys = (body.keys ?? []).map((item) => item.translationKey).sort();
    expect(pushedKeys).toEqual([
      'screens.auth.login.button',
      'screens.home.index.subtitle',
      'screens.home.index.title',
    ]);
  });
});
