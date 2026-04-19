import { setTimeout as delay } from 'node:timers/promises';
import type { CliConfig } from '../../config/cli-config';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HttpClientOptions {
  baseUrl: string;
  timeout: number;
  retries: number;
  debug?: boolean;
  cliVersion?: string;
  fetcher?: typeof fetch;
}

export interface HttpErrorMeta {
  status?: number;
  category: 'transient' | 'authentication' | 'permanent' | 'system';
  retryAfterMs?: number;
}

export interface HttpRequestOptions {
  token?: string;
  headers?: Record<string, string>;
  acceptStatuses?: number[];
  onResponse?: (response: Response) => void;
}

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly meta: HttpErrorMeta,
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

// Retry only failures where repeating the same request is expected to be safe:
// timeout, rate limit, or server-side/transient outage. Auth and 4xx validation
// errors need user/config changes, so retrying them would just hide the real issue.
const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  // Rate limits are controlled by the server, so prefer its Retry-After window
  // over local backoff when it provides either seconds or an HTTP date.
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryDate = Date.parse(value);
  if (Number.isNaN(retryDate)) {
    return undefined;
  }

  return Math.max(0, retryDate - Date.now());
}

async function requestWithTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);

  try {
    const response = await request(controller.signal);
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (timedOut) {
      throw new HttpClientError('Request timed out', { category: 'transient' });
    }
    throw error;
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly debug: boolean;
  private readonly cliVersion?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.timeout = options.timeout;
    this.retries = options.retries;
    this.debug = options.debug ?? false;
    this.cliVersion = options.cliVersion;
    this.fetcher = options.fetcher ?? globalThis.fetch;
  }

  static fromConfig(config: CliConfig): HttpClient {
    return new HttpClient({
      baseUrl: config.apiEndpoint,
      timeout: config.timeout,
      retries: config.retries,
      debug: config.debug,
    });
  }

  async get<T>(path: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T, B = unknown>(path: string, body?: B, token?: string): Promise<T> {
    return this.request<T>('POST', path, body, { token });
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options: HttpRequestOptions = {},
  ): Promise<T> {
    const cliVersion = this.cliVersion ?? process.env.npm_package_version ?? '0.1.0';
    const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(path, baseUrl).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Curlydots-Cli-Version': cliVersion,
    };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }
    }

    const attemptRequest = async (signal: AbortSignal): Promise<T> => {
      let response: Response;
      try {
        response = await this.fetcher(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal,
        });
      } catch {
        throw new HttpClientError('System error communicating with backend', {
          category: 'transient',
        });
      }

      options.onResponse?.(response);

      const acceptedStatus = options.acceptStatuses?.includes(response.status) ?? false;

      if (this.debug) {
        console.log(`[HTTP] ${method} ${url} -> ${response.status}`);
      }

      if (!response.ok && !acceptedStatus) {
        await this.handleError(response);
      }

      if (response.status === 204 || response.status === 205 || response.status === 304) {
        return undefined as T;
      }

      return (await response.json()) as T;
    };

    return this.retry(async () => {
      try {
        return await requestWithTimeout((signal) => attemptRequest(signal), this.timeout);
      } catch (error) {
        if (error instanceof HttpClientError) {
          throw error;
        }

        throw new HttpClientError('System error communicating with backend', {
          category: 'system',
        });
      }
    });
  }

  private async retry<T>(fn: (attempt: number) => Promise<T>): Promise<T> {
    let attempt = 0;
    let delayMs = 1000;
    const maxDelayMs = 5000;

    while (true) {
      try {
        return await fn(attempt);
      } catch (error) {
        if (
          !(error instanceof HttpClientError) ||
          error.meta.category !== 'transient' ||
          attempt >= this.retries
        ) {
          throw error;
        }
        attempt += 1;
        const waitMs = error.meta.retryAfterMs ?? delayMs;
        await delay(waitMs);
        delayMs = Math.min(
          error.meta.retryAfterMs ? Math.max(waitMs * 2, delayMs) : delayMs * 2,
          maxDelayMs,
        );
      }
    }
  }

  private async handleError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) {
        errorMessage = data.message;
      }
    } catch {
      // ignore
    }

    // Always include the URL in error messages for debugging
    errorMessage = `${errorMessage} (${response.url})`;

    if (response.status === 401 || response.status === 403) {
      throw new HttpClientError(errorMessage, {
        status: response.status,
        category: 'authentication',
      });
    }

    if (isRetryableStatus(response.status)) {
      const retryAfterMs =
        response.status === 429
          ? (parseRetryAfterMs(response.headers.get('Retry-After')) ?? 10_000)
          : undefined;
      throw new HttpClientError(errorMessage, {
        status: response.status,
        category: 'transient',
        retryAfterMs,
      });
    }

    throw new HttpClientError(errorMessage, {
      status: response.status,
      category: 'permanent',
    });
  }
}
