import type {
  TranslationSyncKeyPayload,
  TranslationSyncRunResponse,
} from '../../types/translation-sync';
import type { HttpClient } from '../http/client';

export async function startTranslationSyncRun(
  client: HttpClient,
  teamSlug: string,
  projectSlug: string,
  token: string,
  sourceLanguage: string,
  keys: TranslationSyncKeyPayload[],
  idempotencyKey: string,
): Promise<TranslationSyncRunResponse['data']> {
  const response = await client.post<TranslationSyncRunResponse>(
    `/api/teams/${encodeURIComponent(teamSlug)}/projects/${encodeURIComponent(projectSlug)}/translation-sync-runs`,
    { source_language: sourceLanguage, keys },
    {
      token,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    },
  );

  return response.data;
}
