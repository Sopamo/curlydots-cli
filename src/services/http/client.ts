import { setTimeout as delay } from 'node:timers/promises';
import type { CliConfig } from '../../config/cli-config';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HttpClientOptions {
  baseUrl: string;
  timeout: number;
  retries: number;
  debug?: boolean;
}

export interface HttpErrorMeta {
  status?: number;
  category: 'transient' | 'authentication' | 'permanent' | 'system';
}

export interface HttpRequestOptions {
  token?: string;
  headers?: Record<string, string>;
  acceptStatuses?: number[];
  onResponse?: (response: Response) => void;
}

export class HttpClientError extends Error {
  constructor(message: string, public readonly meta: HttpErrorMeta) {
    super(message);
    this.name = 'HttpClientError';
  }
}

const retryableStatus = new Set([408, 429, 500, 502, 503, 504]);

async function requestWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    const response = await promise;
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly debug: boolean;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.timeout = options.timeout;
    this.retries = options.retries;
    this.debug = options.debug ?? false;
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
    const cliVersion = process.env.npm_package_version ?? '0.1.0';
    const baseUrl = this.baseUrl.endsWith('/')
      ? this.baseUrl
      : `${this.baseUrl}/`;
    const url = new URL(path, baseUrl).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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

    const attemptRequest = async (): Promise<T> => {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

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

    return this.retry(async (attempt) => {
      try {
        return await requestWithTimeout(attemptRequest(), this.timeout);
      } catch (error) {
        if (error instanceof HttpClientError) {
          if (error.meta.category === 'transient' && attempt < this.retries) {
            throw error;
          }
          throw error;
        }
        if (attempt >= this.retries) {
          throw new HttpClientError('System error communicating with backend', { category: 'system' });
        }
        throw error;
      }
    });
  }

  private async retry<T>(fn: (attempt: number) => Promise<T>): Promise<T> {
    let attempt = 0;
    let delayMs = 1000;

    while (attempt <= this.retries) {
      try {
        return await fn(attempt);
      } catch (error) {
        attempt += 1;
        if (attempt > this.retries) {
          throw error;
        }
        await delay(delayMs);
        delayMs *= 2;
      }
    }

    throw new Error('Retry failed');
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

    if (response.status === 401 || response.status === 403) {
      throw new HttpClientError(errorMessage, {
        status: response.status,
        category: 'authentication',
      });
    }

    if (retryableStatus.has(response.status)) {
      throw new HttpClientError(errorMessage, {
        status: response.status,
        category: 'transient',
      });
    }

    throw new HttpClientError(errorMessage, {
      status: response.status,
      category: 'permanent',
    });
  }
}
