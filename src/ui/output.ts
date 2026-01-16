export interface PushSummary {
  scanned: number;
  skipped: number;
  uploaded: number;
  failed: number;
  batches: number;
}

export function formatPushSummary(summary: PushSummary): string {
  return [
    `Scanned: ${summary.scanned}`,
    `Skipped: ${summary.skipped}`,
    `Uploaded: ${summary.uploaded}`,
    `Failed: ${summary.failed}`,
    `Batches: ${summary.batches}`,
  ].join('\n');
}

export function formatPushSummaryJson(summary: PushSummary): string {
  return JSON.stringify(summary, null, 2);
}
