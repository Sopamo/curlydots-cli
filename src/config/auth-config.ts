import { z } from 'zod';
import {
  ensureGlobalCurlydotsConfigFiles,
  findNearestProjectCurlydotsFilePath,
  getGlobalCurlydotsFilePath,
  parseJsonObjectFile,
  readSchemaVersion,
  writeJsonObjectFile,
} from './config-paths';

export const AUTH_CONFIG_PATH = getGlobalCurlydotsFilePath('auth.json');
const AUTH_SCHEMA_VERSION = 1;
const warnedVersionPaths = new Set<string>();
const AUTH_METHODS = new Set(['browser', 'api_key', 'environment']);
const TOKEN_STORAGES = new Set(['keychain', 'file', 'environment']);

const authConfigSchema = z.object({
  authMethod: z.enum(['browser', 'api_key', 'environment']),
  tokenStorage: z.enum(['keychain', 'file', 'environment']),
  token: z.string().optional(),
});

export type CliAuthConfig = z.infer<typeof authConfigSchema>;

const defaultAuthConfig: CliAuthConfig = {
  authMethod: 'browser',
  tokenStorage: 'keychain',
  token: undefined,
};

function normalizeAuthFileShape(rawConfig: Record<string, unknown>): Record<string, unknown> {
  const authMethod = typeof rawConfig.authMethod === 'string' && AUTH_METHODS.has(rawConfig.authMethod)
    ? rawConfig.authMethod
    : 'browser';
  const tokenStorage = typeof rawConfig.tokenStorage === 'string' && TOKEN_STORAGES.has(rawConfig.tokenStorage)
    ? rawConfig.tokenStorage
    : 'keychain';

  const normalized: Record<string, unknown> = {
    schemaVersion: AUTH_SCHEMA_VERSION,
    authMethod,
    tokenStorage,
  };

  if (typeof rawConfig.token === 'string' && rawConfig.token !== '') {
    normalized.token = rawConfig.token;
  }

  return normalized;
}

function warnUnsupportedSchemaVersion(filePath: string, version: number): void {
  if (warnedVersionPaths.has(filePath)) {
    return;
  }

  warnedVersionPaths.add(filePath);
  console.warn(
    `[curlydots] ${filePath} uses schemaVersion ${version}, but this CLI supports up to ${AUTH_SCHEMA_VERSION}. Please update Curlydots CLI.`,
  );
}

function normalizeVersionedAuthConfig(filePath: string, rawConfig: Record<string, unknown>): Record<string, unknown> {
  const version = readSchemaVersion(rawConfig);

  if (version > AUTH_SCHEMA_VERSION) {
    warnUnsupportedSchemaVersion(filePath, version);
    return rawConfig;
  }

  const normalized = normalizeAuthFileShape(rawConfig);
  if (JSON.stringify(normalized) !== JSON.stringify(rawConfig)) {
    writeJsonObjectFile(filePath, normalized);
  }
  return normalized;
}

export function loadCliAuthConfig(): CliAuthConfig {
  ensureGlobalCurlydotsConfigFiles();

  const globalAuthConfig = normalizeVersionedAuthConfig(
    AUTH_CONFIG_PATH,
    parseJsonObjectFile(AUTH_CONFIG_PATH),
  );
  const projectAuthConfigPath = findNearestProjectCurlydotsFilePath('auth.json');
  const projectAuthConfig = projectAuthConfigPath && projectAuthConfigPath !== AUTH_CONFIG_PATH
    ? normalizeVersionedAuthConfig(projectAuthConfigPath, parseJsonObjectFile(projectAuthConfigPath))
    : {};

  const envConfig: Record<string, unknown> = {
    token: process.env.CURLYDOTS_TOKEN,
  };

  const merged = {
    ...defaultAuthConfig,
    ...globalAuthConfig,
    ...projectAuthConfig,
    ...Object.fromEntries(
      Object.entries(envConfig).filter(([, value]) => value !== undefined && value !== ''),
    ),
  };

  return authConfigSchema.parse(merged);
}
