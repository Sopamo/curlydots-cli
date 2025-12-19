import os from 'node:os';
import open from 'open';
import { loadCliConfig, type CliConfig } from '../../config/cli-config';
import { HttpClient, HttpClientError } from '../http/client';
import { globalLogger } from '../../utils/logger';

export interface DeviceInfo {
  platform: NodeJS.Platform;
  arch: string;
  release: string;
  hostname: string;
  version: string;
}

export interface LoginResponse {
  browserUrl: string;
  pollingUrl: string;
  pairingCode: string;
  expiresAt: string;
}

export interface PollResponse {
  status: 'pending' | 'completed' | 'failed' | 'expired';
  token?: AuthToken;
  error?: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope?: string[];
}

export interface BrowserLoginOptions {
  openBrowser?: (url: string) => Promise<void>;
  wait?: (ms: number) => Promise<void>;
  client?: HttpClient;
  config?: CliConfig;
  logger?: typeof globalLogger;
  signal?: AbortSignal;
  manual?: boolean;
}

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function describeHttpError(error: unknown): string {
  if (error instanceof HttpClientError) {
    const prefix = error.meta.category === 'authentication'
      ? 'Authentication error'
      : error.meta.category === 'transient'
        ? 'Temporary network error'
        : error.meta.category === 'system'
          ? 'System error'
          : 'Request error';
    return `${prefix}: ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

function createDeviceInfo(): DeviceInfo {
  return {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    hostname: os.hostname(),
    version: os.version?.() ?? os.release(),
  };
}

function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segmentLength = 4;
  const segments: string[] = [];
  for (let s = 0; s < 3; s += 1) {
    let segment = '';
    for (let i = 0; i < segmentLength; i += 1) {
      const index = Math.floor(Math.random() * alphabet.length);
      segment += alphabet[index] ?? 'A';
    }
    segments.push(segment);
  }
  return segments.join('-');
}

export async function runBrowserLogin(options: BrowserLoginOptions = {}): Promise<AuthToken> {
  const config = options.config ?? loadCliConfig();
  const client = options.client ?? HttpClient.fromConfig(config);
  const openBrowser = options.openBrowser ?? open;
  const wait = options.wait ?? defaultWait;
  const logger = options.logger ?? globalLogger;
  const signal = options.signal;
  const manual = options.manual ?? false;

  const deviceInfo = createDeviceInfo();
  logger.info('Initiating browser-based authentication…');

  const pairingCode = generatePairingCode();

  let loginResponse: LoginResponse;
  try {
    loginResponse = await client.post<LoginResponse>('/auth/login', {
      deviceInfo,
      pairingCode,
    });
  } catch (error) {
    throw new Error(describeHttpError(error));
  }

  const code = loginResponse.pairingCode ?? pairingCode;
  logger.info(`Pairing code: ${code}`);

  if (manual) {
    logger.info(`Open ${loginResponse.browserUrl} in your browser and enter the pairing code.`);
  } else {
    try {
      await openBrowser(loginResponse.browserUrl);
    } catch (error) {
      logger.warn('Unable to open browser automatically. Please open the above URL manually.');
      logger.warn(`Reason: ${(error as Error)?.message ?? 'unknown'}`);
      logger.info(loginResponse.browserUrl);
    }
  }

  logger.info('Waiting for browser authentication to complete… (Ctrl+C to cancel)');
  const token = await pollForResult(
    client,
    loginResponse.pollingUrl,
    loginResponse.expiresAt,
    wait,
    logger,
    signal,
  );
  logger.success('Authentication successful. Returning token to caller.');

  return token;
}

async function pollForResult(
  client: HttpClient,
  pollingUrl: string,
  expiresAt: string,
  wait: (ms: number) => Promise<void>,
  logger: typeof globalLogger,
  signal?: AbortSignal,
): Promise<AuthToken> {
  const expiry = new Date(expiresAt).getTime();
  const pollInterval = 2000;
  let aborted = false;

  const abortHandler = () => {
    aborted = true;
  };
  if (signal) {
    signal.addEventListener('abort', abortHandler);
  }

  while (Date.now() < expiry) {
    if (aborted) {
      signal?.removeEventListener('abort', abortHandler);
      throw new Error('Authentication cancelled by user.');
    }

    let response: PollResponse;
    try {
      response = await client.get<PollResponse>(pollingUrl);
    } catch (error) {
      throw new Error(describeHttpError(error));
    }

    if (response.status === 'completed' && response.token) {
      signal?.removeEventListener('abort', abortHandler);
      return response.token;
    }

    if (response.status === 'failed') {
      throw new Error(response.error ?? 'Authentication failed');
    }

    if (response.status === 'expired') {
      throw new Error('Authentication session expired. Please try again.');
    }

    logger.info('Still waiting for confirmation…');
    await wait(pollInterval);
  }

  signal?.removeEventListener('abort', abortHandler);
  throw new Error('Authentication timed out. Please retry.');
}
