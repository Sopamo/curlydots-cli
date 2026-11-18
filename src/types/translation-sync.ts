export interface TranslationSyncKeyPayload {
  key: string;
  default_value: string;
  context?: string;
}

export interface TranslationSyncRunResponse {
  data: {
    run_id: string;
    status: string;
    imported_keys_count: number;
    queued_batches_count: number;
  };
}
