import { clearAuthToken } from '../../services/auth/token-manager';
import { globalLogger } from '../../utils/logger';

export async function authLogoutCommand(_args: string[]): Promise<void> {
  try {
    await clearAuthToken();
    globalLogger.success('Logged out locally. Stored credentials have been removed.');
    if (process.env.CURLYDOTS_TOKEN) {
      globalLogger.warn('API tokens provided via CURLYDOTS_TOKEN are not revoked by this command.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    globalLogger.error(`Logout failed: ${message}`, error instanceof Error ? error : undefined);
    process.exitCode = 1;
  }
}
