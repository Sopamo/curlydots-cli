import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import { globalLogger } from '../../utils/logger';

export const DEFAULT_UPDATE_PACKAGE_NAME = '@curlydots/cli';
export const DEFAULT_NPM_REGISTRY_BASE_URL = 'https://registry.npmjs.org';
export const DEFAULT_UPDATE_CHECK_TIMEOUT_MS = 1500;

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export interface UpdateLogger {
  warn(message: string): void;
  success(message: string): void;
}

export interface ShouldSkipUpdateCheckOptions {
  argv: string[];
  env?: NodeJS.ProcessEnv;
  isTTY?: boolean;
  exitCode?: string | number | null;
}

export interface FetchLatestPackageVersionOptions {
  packageName: string;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  registryBaseUrl?: string;
  timeoutMs?: number;
}

export interface PromptForUpdateOptions {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  askUser?: (question: string) => Promise<boolean>;
  logger?: UpdateLogger;
}

export interface RunNpmUpdateOptions {
  packageName: string;
  platform?: NodeJS.Platform;
  spawnSyncImpl?: typeof spawnSync;
}

export interface MaybeRunSelfUpdateOptions {
  argv: string[];
  currentVersion: string;
  packageName?: string;
  env?: NodeJS.ProcessEnv;
  isTTY?: boolean;
  exitCode?: string | number | null;
  fetchLatestVersionImpl?: (options: FetchLatestPackageVersionOptions) => Promise<string | null>;
  promptForUpdateImpl?: (options: PromptForUpdateOptions) => Promise<boolean>;
  runNpmUpdateImpl?: (options: RunNpmUpdateOptions) => boolean;
  logger?: UpdateLogger;
  registryBaseUrl?: string;
  timeoutMs?: number;
}

export interface MaybeRunSelfUpdateResult {
  status: 'skipped' | 'up-to-date' | 'check-failed' | 'declined' | 'updated' | 'update-failed';
  latestVersion?: string;
}

const SEMVER_REGEX =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseSemver(version: string): ParsedSemver | null {
  const match = version.trim().match(SEMVER_REGEX);
  if (!match) {
    return null;
  }

  const prerelease = match[4] ? match[4].split('.') : [];
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

function comparePrereleaseIdentifier(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    return Number(left) - Number(right);
  }

  if (leftNumeric && !rightNumeric) {
    return -1;
  }

  if (!leftNumeric && rightNumeric) {
    return 1;
  }

  return left.localeCompare(right);
}

export function compareSemver(left: string, right: string): number {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);

  if (!parsedLeft || !parsedRight) {
    return 0;
  }

  if (parsedLeft.major !== parsedRight.major) {
    return parsedLeft.major - parsedRight.major;
  }

  if (parsedLeft.minor !== parsedRight.minor) {
    return parsedLeft.minor - parsedRight.minor;
  }

  if (parsedLeft.patch !== parsedRight.patch) {
    return parsedLeft.patch - parsedRight.patch;
  }

  const leftPrereleaseCount = parsedLeft.prerelease.length;
  const rightPrereleaseCount = parsedRight.prerelease.length;
  if (leftPrereleaseCount === 0 && rightPrereleaseCount === 0) {
    return 0;
  }

  if (leftPrereleaseCount === 0) {
    return 1;
  }

  if (rightPrereleaseCount === 0) {
    return -1;
  }

  const maxCount = Math.max(leftPrereleaseCount, rightPrereleaseCount);
  for (let index = 0; index < maxCount; index += 1) {
    const leftIdentifier = parsedLeft.prerelease[index];
    const rightIdentifier = parsedRight.prerelease[index];

    if (leftIdentifier === undefined) {
      return -1;
    }
    if (rightIdentifier === undefined) {
      return 1;
    }

    const result = comparePrereleaseIdentifier(leftIdentifier, rightIdentifier);
    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

export function isNewerVersion(currentVersion: string, candidateVersion: string): boolean {
  return compareSemver(currentVersion, candidateVersion) < 0;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function shouldSkipUpdateCheck(options: ShouldSkipUpdateCheckOptions): boolean {
  const {
    argv,
    env = process.env,
    isTTY = Boolean(process.stdout.isTTY && process.stdin.isTTY),
    exitCode = process.exitCode,
  } = options;

  if (!isTTY) {
    return true;
  }

  if (isTruthy(env.CURLYDOTS_NO_UPDATE_CHECK) || isTruthy(env.CURLYDOTS_DISABLE_UPDATE_CHECK)) {
    return true;
  }

  if (isTruthy(env.CI)) {
    return true;
  }

  if (
    (typeof exitCode === 'number' && exitCode !== 0) ||
    (typeof exitCode === 'string' && exitCode !== '0')
  ) {
    return true;
  }

  if (argv.includes('-v') || argv.includes('--version')) {
    return true;
  }

  return false;
}

export function resolveNpmLatestUrl(
  packageName: string,
  registryBaseUrl = DEFAULT_NPM_REGISTRY_BASE_URL,
): string {
  const normalizedRegistryBaseUrl = registryBaseUrl.replace(/\/+$/u, '');
  return `${normalizedRegistryBaseUrl}/${encodeURIComponent(packageName)}/latest`;
}

export async function fetchLatestPackageVersion(
  options: FetchLatestPackageVersionOptions,
): Promise<string | null> {
  const {
    packageName,
    fetchImpl = fetch,
    registryBaseUrl = DEFAULT_NPM_REGISTRY_BASE_URL,
    timeoutMs = DEFAULT_UPDATE_CHECK_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(resolveNpmLatestUrl(packageName, registryBaseUrl), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { version?: unknown };
    if (typeof payload.version !== 'string') {
      return null;
    }

    return payload.version;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function defaultAskUser(question: string): Promise<boolean> {
  const readlineInterface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await readlineInterface.question(question)).trim().toLowerCase();
    if (!answer) {
      return true;
    }

    return answer === 'y' || answer === 'yes';
  } finally {
    readlineInterface.close();
  }
}

export async function promptForUpdate(options: PromptForUpdateOptions): Promise<boolean> {
  const {
    packageName,
    currentVersion,
    latestVersion,
    askUser = defaultAskUser,
    logger = globalLogger,
  } = options;

  logger.warn(
    `A newer CurlyDots CLI version is available (${currentVersion} -> ${latestVersion}).`,
  );
  return askUser(`Run "npm i -g ${packageName}@latest" now? [Y/n] `);
}

export function runNpmUpdate(options: RunNpmUpdateOptions): boolean {
  const { packageName, spawnSyncImpl = spawnSync, platform = process.platform } = options;
  const npmCommand = platform === 'win32' ? 'npm.cmd' : 'npm';

  const result = spawnSyncImpl(
    npmCommand,
    ['install', '-g', `${packageName}@latest`, '--no-audit', '--progress=false'],
    {
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }

  return result.status === 0;
}

export async function maybeRunSelfUpdate(
  options: MaybeRunSelfUpdateOptions,
): Promise<MaybeRunSelfUpdateResult> {
  const {
    argv,
    currentVersion,
    packageName = DEFAULT_UPDATE_PACKAGE_NAME,
    fetchLatestVersionImpl = fetchLatestPackageVersion,
    promptForUpdateImpl = promptForUpdate,
    runNpmUpdateImpl = runNpmUpdate,
    logger = globalLogger,
    env = process.env,
    isTTY = Boolean(process.stdout.isTTY && process.stdin.isTTY),
    exitCode = process.exitCode,
    registryBaseUrl = DEFAULT_NPM_REGISTRY_BASE_URL,
    timeoutMs = DEFAULT_UPDATE_CHECK_TIMEOUT_MS,
  } = options;

  if (shouldSkipUpdateCheck({ argv, env, isTTY, exitCode })) {
    return { status: 'skipped' };
  }

  const latestVersion = await fetchLatestVersionImpl({
    packageName,
    registryBaseUrl,
    timeoutMs,
  });
  if (!latestVersion) {
    return { status: 'check-failed' };
  }

  if (!isNewerVersion(currentVersion, latestVersion)) {
    return { status: 'up-to-date', latestVersion };
  }

  const shouldUpdate = await promptForUpdateImpl({
    packageName,
    currentVersion,
    latestVersion,
    logger,
  });
  if (!shouldUpdate) {
    return { status: 'declined', latestVersion };
  }

  try {
    const updated = runNpmUpdateImpl({
      packageName,
    });
    if (!updated) {
      logger.warn(`Unable to update ${packageName}. Please run "npm i -g ${packageName}@latest".`);
      return { status: 'update-failed', latestVersion };
    }
  } catch {
    logger.warn(`Unable to update ${packageName}. Please run "npm i -g ${packageName}@latest".`);
    return { status: 'update-failed', latestVersion };
  }

  logger.success(
    `Updated ${packageName} to ${latestVersion}. Restart CurlyDots to use the new version.`,
  );
  return { status: 'updated', latestVersion };
}
