import { z } from 'zod';
import {
  ensureGlobalCurlydotsConfigFiles,
  findNearestProjectCurlydotsFilePath,
  getGlobalCurlydotsFilePath,
  parseJsonObjectFile,
  readSchemaVersion,
  writeJsonObjectFile,
} from './config-paths';

export const CLI_CONFIG_PATH = getGlobalCurlydotsFilePath('config.json');
const CONFIG_SCHEMA_VERSION = 1;
const warnedVersionPaths = new Set<string>();
const DEFAULT_API_ENDPOINT = 'https://curlydots.com/api';

const cliConfigSchema = z.object({
  apiEndpoint: z.string().url(),
  defaultLocale: z.string().optional(),
  timeout: z.number().int().positive(),
  retries: z.number().int().nonnegative(),
  debug: z.boolean(),
});

const defaultConfig: CliConfig = {
  apiEndpoint: DEFAULT_API_ENDPOINT,
  timeout: 30_000,
  retries: 3,
  debug: false,
  defaultLocale: undefined,
};

export type CliConfig = z.infer<typeof cliConfigSchema>;

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function pickFileConfigValues(config: Record<string, unknown>): Record<string, unknown> {
  return {
    apiEndpoint: config.apiEndpoint,
    defaultLocale: config.defaultLocale,
    debug: config.debug,
  };
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  return undefined;
}

function normalizeConfigFileShape(rawConfig: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    apiEndpoint: typeof rawConfig.apiEndpoint === 'string' ? rawConfig.apiEndpoint : DEFAULT_API_ENDPOINT,
    debug: coerceBoolean(rawConfig.debug) ?? false,
  };

  if (typeof rawConfig.defaultLocale === 'string' && rawConfig.defaultLocale.trim() !== '') {
    normalized.defaultLocale = rawConfig.defaultLocale;
  }

  return normalized;
}

function warnUnsupportedSchemaVersion(filePath: string, version: number): void {
  if (warnedVersionPaths.has(filePath)) {
    return;
  }

  warnedVersionPaths.add(filePath);
  console.warn(
    `[curlydots] ${filePath} uses schemaVersion ${version}, but this CLI supports up to ${CONFIG_SCHEMA_VERSION}. Please update Curlydots CLI.`,
  );
}

function normalizeVersionedConfig(filePath: string, rawConfig: Record<string, unknown>): Record<string, unknown> {
  const version = readSchemaVersion(rawConfig);

  if (version > CONFIG_SCHEMA_VERSION) {
    warnUnsupportedSchemaVersion(filePath, version);
    return rawConfig;
  }

  const normalized = normalizeConfigFileShape(rawConfig);
  if (JSON.stringify(normalized) !== JSON.stringify(rawConfig)) {
    writeJsonObjectFile(filePath, normalized);
  }
  return normalized;
}

export function loadCliConfig(): CliConfig {
  ensureGlobalCurlydotsConfigFiles();

  const globalConfig = pickFileConfigValues(
    normalizeVersionedConfig(CLI_CONFIG_PATH, parseJsonObjectFile(CLI_CONFIG_PATH)),
  );
  const projectConfigPath = findNearestProjectCurlydotsFilePath('config.json');
  const projectConfig = projectConfigPath && projectConfigPath !== CLI_CONFIG_PATH
    ? pickFileConfigValues(
      normalizeVersionedConfig(projectConfigPath, parseJsonObjectFile(projectConfigPath)),
    )
    : {};

  const envConfig: Record<string, unknown> = {
    apiEndpoint: process.env.CURLYDOTS_API_URL,
    debug: parseBoolean(process.env.CURLYDOTS_DEBUG),
  };

  const merged = {
    ...defaultConfig,
    ...globalConfig,
    ...projectConfig,
    ...Object.fromEntries(
      Object.entries(envConfig).filter(([, value]) => value !== undefined && value !== ''),
    ),
  };

  return cliConfigSchema.parse(merged);
}
