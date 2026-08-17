import type {
  TranslationSyncKeyPayload,
  TranslationSyncRunResponse,
} from '../../types/translation-sync';
import type { HttpClient } from '../http/client';

export interface StartTranslationSyncRunResult {
  runId: string;
  status: string;
  importedKeysCount: number;
  queuedBatchesCount: number;
}

export async function startTranslationSyncRun(
  client: HttpClient,
  teamSlug: string,
  projectSlug: string,
  token: string,
  keys: TranslationSyncKeyPayload[],
  idempotencyKey: string,
): Promise<StartTranslationSyncRunResult> {
  const response = await client.post<TranslationSyncRunResponse>(
    `/api/teams/${encodeURIComponent(teamSlug)}/projects/${encodeURIComponent(projectSlug)}/translation-sync-runs`,
    { keys },
    {
      token,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    },
  );

  return {
    runId: response.data.run_id,
    status: response.data.status,
    importedKeysCount: response.data.imported_keys_count,
    queuedBatchesCount: response.data.queued_batches_count,
  };
}
