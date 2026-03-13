import { getAuthStatus } from '../../services/auth/status-presenter';
import { loadCliAuthConfig } from '../../config/auth-config';
import { globalLogger } from '../../utils/logger';

function formatAuthSource(storage: string): string {
  if (storage === 'environment') {
    return 'environment token (CURLYDOTS_TOKEN)';
  }

  if (storage === 'keychain') {
    return 'browser session (keychain)';
  }

  if (storage === 'file') {
    const authConfig = loadCliAuthConfig();

    if (authConfig.token) {
      return 'API token from auth.json';
    }

    return 'browser session (file fallback)';
  }

  return storage;
}

export async function authStatusCommand(_args: string[]): Promise<void> {
  const status = await getAuthStatus();

  if (!status.authenticated) {
    globalLogger.warn('Not authenticated. Run `curlydots auth login` to authenticate.');
    return;
  }

  const expiryLabel = status.expiresAt ? ` (expires ${status.expiresAt})` : '';
  const expiredNote = status.expired ? ' (expired)' : '';
  const source = formatAuthSource(status.storage);
  globalLogger.success(`Authenticated via ${source}${expiryLabel}${expiredNote}.`);
}
