import { formatAuthSourceLabel, getAuthStatus } from '../../services/auth/service';
import { globalLogger } from '../../utils/logger';

export async function authStatusCommand(_args: string[]): Promise<void> {
  const status = await getAuthStatus();

  if (status.expired) {
    const expiryLabel = status.expiresAt ? ` (expired ${status.expiresAt})` : ' (expired)';
    globalLogger.warn(
      `Authentication expired${expiryLabel}. Run \`curlydots auth login\` to authenticate again.`,
    );
    return;
  }

  if (!status.authenticated) {
    globalLogger.warn('Not authenticated. Run `curlydots auth login` to authenticate.');
    return;
  }

  const expiryLabel = status.expiresAt ? ` (expires ${status.expiresAt})` : '';
  const expiredNote = status.expired ? ' (expired)' : '';
  const source = formatAuthSourceLabel(status.source, status.storage);
  globalLogger.success(`Authenticated via ${source}${expiryLabel}${expiredNote}.`);
}
