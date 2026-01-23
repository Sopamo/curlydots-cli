import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const CONFIG_DIR = join(homedir(), '.curlydots');
export const CLI_CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const cliConfigSchema = z.object({
  apiEndpoint: z.string().url(),
  authMethod: z.enum(['browser', 'api_key', 'environment']),
  tokenStorage: z.enum(['keychain', 'file', 'environment']),
  defaultLocale: z.string().optional(),
  timeout: z.number().int().positive(),
  retries: z.number().int().nonnegative(),
  debug: z.boolean(),
  token: z.string().optional(),
});

const defaultConfig: CliConfig = {
  apiEndpoint: 'https://curlydots.com/api',
  authMethod: 'browser',
  tokenStorage: 'keychain',
  timeout: 30_000,
  retries: 3,
  debug: false,
  token: undefined,
  defaultLocale: undefined,
};

export type CliConfig = z.infer<typeof cliConfigSchema>;

function parseJsonFile(filePath: string): Record<string, unknown> {
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

function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const content = readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .reduce<Record<string, string>>((acc, line) => {
        const [rawKey, ...rawValue] = line.split('=');
        const key = rawKey?.trim();
        if (!key) return acc;
        const value = rawValue.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (value !== '') {
          acc[key] = value;
        }
        return acc;
      }, {});
  } catch {
    return {};
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function loadCliConfig(): CliConfig {
  const fileConfig = existsSync(CLI_CONFIG_PATH)
    ? parseJsonFile(CLI_CONFIG_PATH)
    : {};

  const localEnvPath = join(process.cwd(), '.env');
  const localEnv = existsSync(localEnvPath)
    ? parseEnvFile(localEnvPath)
    : {};

  const envConfig: Record<string, unknown> = {
    apiEndpoint: process.env.CURLYDOTS_API_URL ?? localEnv.CURLYDOTS_API_URL,
    token: process.env.CURLYDOTS_TOKEN ?? localEnv.CURLYDOTS_TOKEN,
    debug: parseBoolean(process.env.CURLYDOTS_DEBUG ?? localEnv.CURLYDOTS_DEBUG),
  };

  const merged = {
    ...defaultConfig,
    ...fileConfig,
    ...Object.fromEntries(
      Object.entries(envConfig).filter(([, value]) => value !== undefined && value !== ''),
    ),
  };

  return cliConfigSchema.parse(merged);
}
