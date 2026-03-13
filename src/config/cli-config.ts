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
const DEFAULT_FRONTEND_URL = 'https://curlydots.com';

export type CliConfigSource = 'default' | 'global' | 'project';

const cliConfigSchema = z.object({
  apiEndpoint: z.string().url(),
  frontendUrl: z.string().url(),
  defaultLocale: z.string().optional(),
  timeout: z.number().int().positive(),
  retries: z.number().int().nonnegative(),
  debug: z.boolean(),
});

const defaultConfig: CliConfig = {
  apiEndpoint: DEFAULT_API_ENDPOINT,
  frontendUrl: DEFAULT_FRONTEND_URL,
  timeout: 30_000,
  retries: 3,
  debug: false,
  defaultLocale: undefined,
};

export type CliConfig = z.infer<typeof cliConfigSchema>;

export interface ResolvedCliConfig extends CliConfig {
  sources: {
    apiEndpoint: {
      source: CliConfigSource;
      path?: string;
    };
    frontendUrl: {
      source: CliConfigSource;
      path?: string;
    };
    debug: {
      source: CliConfigSource;
      path?: string;
    };
  };
}

function pickFileConfigValues(config: Record<string, unknown>): Record<string, unknown> {
  return {
    apiEndpoint: config.apiEndpoint,
    frontendUrl: config.frontendUrl,
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
    frontendUrl: typeof rawConfig.frontendUrl === 'string' ? rawConfig.frontendUrl : DEFAULT_FRONTEND_URL,
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

function hasOwnString(config: Record<string, unknown>, key: string): boolean {
  return typeof config[key] === 'string' && String(config[key]).trim() !== '';
}

function hasOwnBooleanLike(config: Record<string, unknown>, key: string): boolean {
  return config[key] !== undefined && coerceBoolean(config[key]) !== undefined;
}

export function loadCliConfig(): ResolvedCliConfig {
  ensureGlobalCurlydotsConfigFiles();

  const globalConfigPath = CLI_CONFIG_PATH;
  const globalRawConfig = normalizeVersionedConfig(globalConfigPath, parseJsonObjectFile(globalConfigPath));

  const globalConfig = pickFileConfigValues(globalRawConfig);
  const projectConfigPath = findNearestProjectCurlydotsFilePath('config.json');
  const projectRawConfig = projectConfigPath && projectConfigPath !== CLI_CONFIG_PATH
    ? normalizeVersionedConfig(projectConfigPath, parseJsonObjectFile(projectConfigPath))
    : null;
  const projectConfig = projectRawConfig ? pickFileConfigValues(projectRawConfig) : {};

  const merged = {
    ...defaultConfig,
    ...globalConfig,
    ...projectConfig,
  };

  const parsed = cliConfigSchema.parse(merged);

  const apiEndpointSource = projectRawConfig && hasOwnString(projectRawConfig, 'apiEndpoint')
    ? { source: 'project' as const, path: projectConfigPath }
    : hasOwnString(globalRawConfig, 'apiEndpoint')
      ? { source: 'global' as const, path: globalConfigPath }
      : { source: 'default' as const };

  const frontendUrlSource = projectRawConfig && hasOwnString(projectRawConfig, 'frontendUrl')
    ? { source: 'project' as const, path: projectConfigPath }
    : hasOwnString(globalRawConfig, 'frontendUrl')
      ? { source: 'global' as const, path: globalConfigPath }
      : { source: 'default' as const };

  const debugSource = projectRawConfig && hasOwnBooleanLike(projectRawConfig, 'debug')
    ? { source: 'project' as const, path: projectConfigPath }
    : hasOwnBooleanLike(globalRawConfig, 'debug')
      ? { source: 'global' as const, path: globalConfigPath }
      : { source: 'default' as const };

  return {
    ...parsed,
    sources: {
      apiEndpoint: apiEndpointSource,
      frontendUrl: frontendUrlSource,
      debug: debugSource,
    },
  };
}
