import { HttpClient } from '../http/client';
import type { ExistingKeysResponse, TranslationKeyPayload } from '../../types/translation-keys';

export interface TranslationKeysClientOptions {
  client: HttpClient;
  token?: string;
  batchSize?: number;
  loadToken?: () => Promise<{ accessToken: string } | null>;
}

export interface UploadResult {
  uploaded: number;
  batches: number;
}

export async function resolveAuthToken(options: TranslationKeysClientOptions): Promise<string | null> {
  if (options.token) return options.token;
  if (options.loadToken) {
    const stored = await options.loadToken();
    return stored?.accessToken ?? null;
  }
  const { loadAuthToken } = await import('../auth/token-manager');
  const stored = await loadAuthToken();
  return stored?.accessToken ?? null;
}

export async function fetchExistingTranslationKeys(
  client: HttpClient,
  projectUuid: string,
  token: string,
): Promise<ExistingKeysResponse> {
  return client.get<ExistingKeysResponse>(`/api/projects/${projectUuid}/translation-keys`, { token });
}

export type UploadProgressCallback = (info: { batch: number; totalBatches: number; uploaded: number; total: number }) => void;

export async function uploadTranslationKeys(
  client: HttpClient,
  projectUuid: string,
  token: string,
  keys: TranslationKeyPayload[],
  batchSize = 100,
  onProgress?: UploadProgressCallback,
): Promise<UploadResult> {
  let uploaded = 0;
  let batches = 0;
  const totalBatch = keys.length === 0 ? 0 : Math.ceil(keys.length / batchSize);

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const currentBatch = batches + 1;
    await client.post(
      `/api/projects/${projectUuid}/translation-keys`,
      { entries: batch, current_batch: currentBatch, total_batch: totalBatch },
      token,
    );
    uploaded += batch.length;
    batches += 1;
    onProgress?.({ batch: currentBatch, totalBatches: totalBatch, uploaded, total: keys.length });
  }

  return { uploaded, batches };
}
