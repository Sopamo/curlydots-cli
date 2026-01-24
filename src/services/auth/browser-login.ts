import crypto from 'node:crypto';
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
  pollToken: string;
}

export interface PollResponse {
  status: 'pending' | 'approved' | 'denied' | 'expired';
  token_payload?: AuthToken;
  denied_reason?: string;
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

function createDeviceLabel(deviceInfo: DeviceInfo): string {
  return `${deviceInfo.hostname} (${deviceInfo.platform})`;
}

function createFingerprintHash(deviceInfo: DeviceInfo): string {
  return crypto
    .createHash('sha256')
    .update(`${deviceInfo.hostname}:${deviceInfo.platform}:${deviceInfo.arch}:${deviceInfo.release}`)
    .digest('hex');
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

  let loginResponse: LoginResponse;
  try {
    const cliVersion = process.env.npm_package_version ?? '0.1.0';
    const deviceLabel = createDeviceLabel(deviceInfo);
    const fingerprintHash = createFingerprintHash(deviceInfo);
    
    const response = await client.post<{ code: string; verification_url: string; expires_at: string; poll_token: string }>(
      'cli/pairings',
      {
        device_label: deviceLabel,
        fingerprint_hash: fingerprintHash,
        cli_version: cliVersion,
      },
    );

    loginResponse = {
      browserUrl: response.verification_url,
      pollingUrl: `cli/pairings/${response.code}`,
      pairingCode: response.code,
      expiresAt: response.expires_at,
      pollToken: response.poll_token,
    };
  } catch (error) {
    throw new Error(describeHttpError(error));
  }

  const code = loginResponse.pairingCode;
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
    signal,
    loginResponse.pollToken,
  );
  logger.success('Authentication successful. Returning token to caller.');

  return token;
}

async function pollForResult(
  client: HttpClient,
  pollingUrl: string,
  expiresAt: string,
  wait: (ms: number) => Promise<void>,
  signal?: AbortSignal,
  pollToken?: string,
): Promise<AuthToken> {
  const expiry = new Date(expiresAt).getTime();
  const pollInterval = 2000;
  const logInterval = 30000;
  let aborted = false;
  let etag: string | undefined;
  let lastModified: string | undefined;
  let lastLogAt = 0;

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

    let response: PollResponse | undefined;
    let lastStatus: number | undefined;
    try {
      response = await client.get<PollResponse>(pollingUrl, {
        headers: {
          ...(etag ? { 'If-None-Match': etag } : {}),
          ...(lastModified ? { 'If-Modified-Since': lastModified } : {}),
          ...(pollToken ? { 'X-Curlydots-Poll-Token': pollToken } : {}),
        },
        acceptStatuses: [304],
        onResponse: (res) => {
          lastStatus = res.status;
          const responseEtag = res.headers.get('etag');
          const responseLastModified = res.headers.get('last-modified');
          if (responseEtag) {
            etag = responseEtag;
          }
          if (responseLastModified) {
            lastModified = responseLastModified;
          }
        },
      });
    } catch (error) {
      globalLogger.error(`Failed to create pairing session: ${describeHttpError(error)}`);
      throw error;
    }

    if (lastStatus === 304) {
      await wait(pollInterval);
      continue;
    }

    if (!response) {
      if (Date.now() - lastLogAt > logInterval) {
        lastLogAt = Date.now();
      }
      await wait(pollInterval);
      continue;
    }

    if (response.status === 'approved' && response.token_payload) {
      signal?.removeEventListener('abort', abortHandler);
      return response.token_payload;
    }

    if (response.status === 'denied') {
      throw new Error(response.denied_reason ?? 'Authentication denied');
    }

    if (response.status === 'expired') {
      throw new Error('Authentication session expired. Please try again.');
    }

    if (Date.now() - lastLogAt > logInterval) {
      lastLogAt = Date.now();
    }
    await wait(pollInterval);
  }

  signal?.removeEventListener('abort', abortHandler);
  throw new Error('Authentication timed out. Please retry.');
}
