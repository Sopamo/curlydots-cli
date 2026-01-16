import { getAuthStatus } from '../../services/auth/status-presenter';
import { globalLogger } from '../../utils/logger';

export async function authStatusCommand(_args: string[]): Promise<void> {
  const status = await getAuthStatus();

  if (!status.authenticated) {
    globalLogger.warn('Not authenticated. Run `curlydots auth login` to authenticate.');
    return;
  }

  const expiryLabel = status.expiresAt ? ` (expires ${status.expiresAt})` : '';
  const expiredNote = status.expired ? ' (expired)' : '';
  globalLogger.success(`Authenticated via ${status.storage}${expiryLabel}${expiredNote}.`);
}
